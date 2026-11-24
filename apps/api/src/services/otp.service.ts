import type { PrismaClient } from '@prisma/client';
import type { Env } from '../config/env.js';
import { generateOtp, hashSecret, sha256Hex, verifySecret } from '../lib/crypto.js';
import { ApiError, unauthorized } from '../lib/http.js';
import { sendMail } from '../lib/mailer.js';

export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;

export interface IssuedChallenge {
  challengeId: string;
  expiresAt: Date;
  /** Present only when ALLOW_DEV_OTP is on (never in production). */
  devCode?: string;
}

export const issueChallenge = async (
  prisma: PrismaClient,
  env: Env,
  input: {
    email: string;
    purpose: 'STAFF_LOGIN' | 'STUDENT_EMAIL' | 'SPONSOR_EMAIL';
    payload: Record<string, unknown>;
    ip: string | null;
  },
): Promise<IssuedChallenge> => {
  const code = generateOtp();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);

  const challenge = await prisma.otpChallenge.create({
    data: {
      // The address itself is not needed to verify a code; the hash is enough
      // to rate-limit and to aud it without keeping a second copy of the PII.
      subjectHash: sha256Hex(input.email.trim().toLowerCase()),
      purpose: input.purpose,
      codeHash: await hashSecret(code),
      expiresAt,
      ip: input.ip,
      payload: input.payload as object,
    },
  });

  const delivery = await sendMail(env, {
    to: input.email,
    subject: otpSubject(input.purpose),
    text: otpBody(code, input.purpose),
  });

  // In production the only way a real user can read the code is the mailbox, so a
  // missing relay must fail loudly instead of leaving the sign-in screen hanging.
  if (!delivery.delivered && !env.ALLOW_DEV_OTP) {
    throw new ApiError(
      503,
      'EMAIL_UNAVAILABLE',
      'The portal could not send the sign-in email. Contact Admin & HR with the time of your attempt.',
    );
  }

  return {
    challengeId: challenge.id,
    expiresAt,
    ...(env.ALLOW_DEV_OTP ? { devCode: code } : {}),
  };
};

const otpSubject = (purpose: 'STAFF_LOGIN' | 'STUDENT_EMAIL' | 'SPONSOR_EMAIL'): string =>
  purpose === 'STAFF_LOGIN'
    ? 'ADA Internship Portal - staff sign-in code'
    : 'ADA Internship Portal - verification code';

const otpBody = (
  code: string,
  purpose: 'STAFF_LOGIN' | 'STUDENT_EMAIL' | 'SPONSOR_EMAIL',
): string =>
  [
    `Your one-time code is: ${code}`,
    '',
    `It is valid for ${OTP_TTL_SECONDS / 60} minutes and can be used once.`,
    purpose === 'STAFF_LOGIN'
      ? 'You will be asked for your authenticator code next.'
      : 'Enter it on the application page to continue.',
    '',
    'If you did not request this code, ignore this email. ADA staff will never ask you for it.',
  ].join('\n');

export interface VerifiedChallenge {
  payload: Record<string, unknown>;
}

/** One generic failure for wrong, expired, replayed and unknown challenges. */
export const verifyChallenge = async (
  prisma: PrismaClient,
  input: { challengeId: string; code: string; purpose: 'STAFF_LOGIN' | 'STUDENT_EMAIL' | 'SPONSOR_EMAIL' },
): Promise<VerifiedChallenge> => {
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: input.challengeId } });
  const unusable =
    !challenge ||
    challenge.purpose !== input.purpose ||
    challenge.consumedAt !== null ||
    challenge.expiresAt.getTime() < Date.now() ||
    challenge.attempts >= OTP_MAX_ATTEMPTS;

  if (!challenge || unusable) throw unauthorized('OTP_INVALID', 'That code is no longer valid. Request a new one.');

  const matches = await verifySecret(challenge.codeHash, input.code);

  if (!matches) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw unauthorized('OTP_INVALID', 'That code is not correct');
  }

  // Single use.
  const consumed = await prisma.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) throw new ApiError(409, 'OTP_ALREADY_USED', 'That code has already been used');

  return { payload: (challenge.payload ?? {}) as Record<string, unknown> };
};

import type { PrismaClient } from '@prisma/client';
import { isAdaEmail, permissionsForRole, type Role } from '@ada/shared';
import type { Env } from '../config/env.js';
import QRCode from 'qrcode';
import { generateTotpSecret, signToken, verifyToken } from '../lib/crypto.js';
import { ApiError, badRequest, unauthorized } from '../lib/http.js';
import { writeAudit } from '../lib/audit.js';
import { totpAt, verifyTotp } from '../lib/totp.js';
import { issueChallenge, verifyChallenge, OTP_TTL_SECONDS } from './otp.service.js';

export const PENDING_TTL_SECONDS = 5 * 60;
const TOTP_ISSUER = 'ADA Internship Portal';

const otpauthUri = (email: string, secret: string): string => {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(TOTP_ISSUER)}&algorithm=SHA1&digits=6&period=30`;
};

export interface StaffUserRow {
  id: string;
  role: Role;
  name: string;
  email: string;
  employeeCode: string | null;
  directorateId: string | null;
  isActive: boolean;
  totpSecret: string | null;
}

const findStaff = (prisma: PrismaClient, email: string): Promise<StaffUserRow | null> =>
  prisma.user
    .findFirst({
      where: { email, role: { not: 'STUDENT' }, deletedAt: null },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        employeeCode: true,
        directorateId: true,
        isActive: true,
        totpSecret: true,
      },
    })
    .then((user) => (user as StaffUserRow | null) ?? null);

/**
 * Step one. The response is identical whether or not the address belongs to an
 * account: no enumeration on the staff login, which is the one page reachable
 * from the intranet at large.
 */
export const requestStaffOtp = async (
  deps: { prisma: PrismaClient; env: Env },
  input: { email: string; ip: string | null },
): Promise<{ challengeId: string; expiresAt: Date; expiresInSeconds: number; devCode?: string }> => {
  if (!isAdaEmail(input.email)) {
    throw badRequest('EMAIL_NOT_ALLOWED', 'Staff sign in with an @ada.gov.in address');
  }
  const challenge = await issueChallenge(deps.prisma, deps.env, {
    email: input.email,
    purpose: 'STAFF_LOGIN',
    payload: { email: input.email },
    ip: input.ip,
  });
  return { ...challenge, expiresInSeconds: OTP_TTL_SECONDS };
};

/** Step two: email OTP proves the mailbox; TOTP has not happened yet. */
export const verifyStaffOtp = async (
  deps: { prisma: PrismaClient; env: Env },
  input: { challengeId: string; code: string; ip: string | null },
): Promise<
  | { stage: 'TOTP_REQUIRED'; pendingId: string; expiresInSeconds: number; devTotpCode?: string }
  | {
      stage: 'TOTP_ENROLMENT_REQUIRED';
      pendingId: string;
      expiresInSeconds: number;
      secret: string;
      otpauthUri: string;
      qrDataUrl: string;
      devTotpCode?: string;
    }
> => {
  const { payload } = await verifyChallenge(deps.prisma, {
    challengeId: input.challengeId,
    code: input.code,
    purpose: 'STAFF_LOGIN',
  });

  const email = typeof payload.email === 'string' ? payload.email : '';
  const user = email ? await findStaff(deps.prisma, email) : null;

  if (!user || !user.isActive) {
    await writeAudit(deps.prisma, {
      actorRole: 'STUDENT',
      action: 'AUTH_LOGIN_FAILED',
      entity: 'user',
      entityId: null,
      reason: 'otp for unknown or inactive staff address',
      ip: input.ip,
      zone: 'internal',
    });
    throw unauthorized('AUTH_FAILED', 'Sign-in could not be completed');
  }

  // First sign-in for an account without an authenticator: the mailbox is already
  // proven, so enrol there and then instead of dead-ending the user. The secret
  // travels inside the signed pending token, never in a database column, until it
  // is confirmed by a valid code.
  if (!user.totpSecret) {
    const secret = generateTotpSecret();
    const pendingId = signToken(
      { sub: user.id, stage: 'enrol', secret },
      deps.env.TOTP_PEPPER,
      PENDING_TTL_SECONDS,
    );
    const uri = otpauthUri(user.email, secret);
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240 });

    return {
      stage: 'TOTP_ENROLMENT_REQUIRED',
      pendingId,
      expiresInSeconds: PENDING_TTL_SECONDS,
      secret,
      otpauthUri: uri,
      qrDataUrl,
      ...(deps.env.ALLOW_DEV_OTP ? { devTotpCode: totpAt(secret) } : {}),
    };
  }

  const pendingId = signToken({ sub: user.id, stage: 'totp' }, deps.env.TOTP_PEPPER, PENDING_TTL_SECONDS);

  return {
    stage: 'TOTP_REQUIRED',
    pendingId,
    expiresInSeconds: PENDING_TTL_SECONDS,
    ...(deps.env.ALLOW_DEV_OTP ? { devTotpCode: totpAt(user.totpSecret) } : {}),
  };
};

/** Step three: the second factor. Only now does a session exist. */
export const verifyStaffTotp = async (
  deps: { prisma: PrismaClient; env: Env },
  input: { pendingId: string; code: string; ip: string | null },
): Promise<{
  user: StaffUserRow;
  permissions: readonly string[];
}> => {
  const pending = verifyToken<{ sub: string; stage: string }>(input.pendingId, deps.env.TOTP_PEPPER);
  if (!pending || pending.stage !== 'totp' || typeof pending.sub !== 'string') {
    throw unauthorized('PENDING_EXPIRED', 'That sign-in attempt expired. Start again.');
  }

  const user = await deps.prisma.user.findFirst({
    where: { id: pending.sub, isActive: true, deletedAt: null },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      employeeCode: true,
      directorateId: true,
      isActive: true,
      totpSecret: true,
    },
  });

  if (!user || !user.totpSecret || !verifyTotp(user.totpSecret, input.code)) {
    await writeAudit(deps.prisma, {
      actorId: user?.id ?? null,
      actorRole: user?.role ?? 'STUDENT',
      action: 'AUTH_LOGIN_FAILED',
      entity: 'user',
      entityId: user?.id ?? null,
      reason: 'invalid totp code',
      ip: input.ip,
      zone: 'internal',
    });
    throw unauthorized('TOTP_INVALID', 'That authenticator code is not valid');
  }

  await deps.prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Every successful sign-in is a transition and gets an audit row.
  await writeAudit(deps.prisma, {
    actorId: user.id,
    actorRole: user.role,
    action: 'AUTH_LOGIN_SUCCEEDED',
    entity: 'user',
    entityId: user.id,
    after: { role: user.role },
    ip: input.ip,
    zone: 'internal',
  });

  return { user: user as StaffUserRow, permissions: permissionsForRole(user.role) };
};

/**
 * Confirms the first authenticator: the code proves the phone holds the secret,
 * and only then does the secret reach the user row.
 */
export const completeTotpEnrolment = async (
  deps: { prisma: PrismaClient; env: Env },
  input: { pendingId: string; code: string; ip: string | null },
): Promise<{ user: StaffUserRow; permissions: readonly string[] }> => {
  const pending = verifyToken<{ sub: string; stage: string; secret: string }>(
    input.pendingId,
    deps.env.TOTP_PEPPER,
  );
  if (!pending || pending.stage !== 'enrol' || typeof pending.sub !== 'string' || !pending.secret) {
    throw unauthorized('PENDING_EXPIRED', 'That enrolment attempt expired. Start again.');
  }

  const user = await deps.prisma.user.findFirst({
    where: { id: pending.sub, isActive: true, deletedAt: null },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      employeeCode: true,
      directorateId: true,
      isActive: true,
      totpSecret: true,
    },
  });
  if (!user) throw unauthorized('AUTH_FAILED', 'Sign-in could not be completed');
  if (user.totpSecret) {
    throw new ApiError(409, 'TOTP_ALREADY_ENROLLED', 'This account already has an authenticator. Sign in with it.');
  }

  if (!verifyTotp(pending.secret, input.code)) {
    await writeAudit(deps.prisma, {
      actorId: user.id,
      actorRole: user.role,
      action: 'AUTH_TOTP_ENROLMENT_FAILED',
      entity: 'user',
      entityId: user.id,
      reason: 'invalid code during enrolment',
      ip: input.ip,
      zone: 'internal',
    });
    throw unauthorized('TOTP_INVALID', 'That authenticator code is not valid');
  }

  const enrolled = await deps.prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: pending.secret, totpEnrolledAt: new Date(), lastLoginAt: new Date() },
  });

  await writeAudit(deps.prisma, {
    actorId: user.id,
    actorRole: user.role,
    action: 'AUTH_TOTP_ENROLLED',
    entity: 'user',
    entityId: user.id,
    after: { enrolledAt: enrolled.totpEnrolledAt?.toISOString() ?? null },
    ip: input.ip,
    zone: 'internal',
  });

  return {
    user: { ...user, totpSecret: enrolled.totpSecret } as StaffUserRow,
    permissions: permissionsForRole(user.role),
  };
};

export const staffLogoutAudit = async (
  deps: { prisma: PrismaClient },
  user: { id: string; role: Role },
  ip: string | null,
): Promise<void> => {
  await writeAudit(deps.prisma, {
    actorId: user.id,
    actorRole: user.role,
    action: 'AUTH_LOGOUT',
    entity: 'user',
    entityId: user.id,
    ip,
    zone: 'internal',
  });
};

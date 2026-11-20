import type { PrismaClient } from '@prisma/client';
import {
  isEditable,
  isLocked,
  maskAadhaar,
  normalizeReferralCode,
  parseReferralCode,
  permissionsForRole,
  type Level,
} from '@ada/shared';
import type { Env } from '../config/env.js';
import { hmacHex, signToken, verifyToken } from '../lib/crypto.js';
import { ApiError, badRequest, unauthorized } from '../lib/http.js';
import { writeAudit } from '../lib/audit.js';
import { issueChallenge, verifyChallenge, OTP_TTL_SECONDS } from './otp.service.js';

export const REFERRAL_TOKEN_TTL_SECONDS = 15 * 60;

/** One generic failure for invalid, expired, revoked and already-used codes (§6). */
const invalidCode = (): ApiError =>
  new ApiError(401, 'INVALID_CODE', 'That referral code cannot be used. Check it with the person who sent it.');

const codeHmac = (code: string, env: Env): string =>
  hmacHex(normalizeReferralCode(code), env.REFERRAL_HMAC_PEPPER);

export interface ReferralPreview {
  sponsorName: string;
  labName: string;
  labCode: string;
  level: Level;
  intakeYear: number;
  expiresAt: Date;
}

/**
 * Redemption step one: validate the code and show who referred the student.
 * Nothing is bound yet - the first OTP-verified email owns the code (§6).
 */
export const redeemReferralCode = async (
  deps: { prisma: PrismaClient; env: Env },
  input: { code: string; ip: string | null },
): Promise<{ referral: ReferralPreview; referralToken: string }> => {
  const parsed = parseReferralCode(input.code);
  if (!parsed.ok) throw invalidCode();

  const record = await deps.prisma.referralCode.findUnique({
    where: { codeHmac: codeHmac(input.code, deps.env) },
    include: { sponsor: true, lab: true },
  });

  if (
    !record ||
    record.revokedAt !== null ||
    record.usedByApplicationId !== null ||
    record.boundStudentEmail !== null ||
    record.expiresAt.getTime() < Date.now()
  ) {
    throw invalidCode();
  }

  const referralToken = signToken({ ref: record.id }, deps.env.SESSION_SECRET, REFERRAL_TOKEN_TTL_SECONDS);

  return {
    referral: {
      sponsorName: record.sponsor.fullName,
      labName: record.lab.name,
      labCode: record.lab.code,
      level: record.level,
      intakeYear: record.intakeYear,
      expiresAt: record.expiresAt,
    },
    referralToken,
  };
};

/** Redemption step two: send the code to the address the student typed. */
export const requestStudentOtp = async (
  deps: { prisma: PrismaClient; env: Env },
  input: { referralToken: string; email: string; ip: string | null },
): Promise<{ challengeId: string; expiresAt: Date; expiresInSeconds: number; devCode?: string }> => {
  const token = verifyToken<{ ref: string }>(input.referralToken, deps.env.SESSION_SECRET);
  if (!token || typeof token.ref !== 'string') throw invalidCode();

  const record = await deps.prisma.referralCode.findUnique({ where: { id: token.ref } });
  if (
    !record ||
    record.revokedAt !== null ||
    record.usedByApplicationId !== null ||
    record.expiresAt.getTime() < Date.now() ||
    (record.boundStudentEmail !== null && record.boundStudentEmail !== input.email)
  ) {
    throw invalidCode();
  }

  const challenge = await issueChallenge(deps.prisma, deps.env, {
    email: input.email,
    purpose: 'STUDENT_EMAIL',
    payload: { codeId: record.id, email: input.email },
    ip: input.ip,
  });

  return { ...challenge, expiresInSeconds: OTP_TTL_SECONDS };
};

export interface StudentApplicationView {
  applicationNo: string | null;
  status: string;
  level: Level;
  intakeYear: number;
  lab: { code: string; name: string };
  sponsorName: string | null;
  student: { fullName: string | null; email: string; aadhaarMasked: string };
  revision: number;
  editable: boolean;
  locked: boolean;
  lockNotice: string | null;
}

/**
 * Redemption step three: the OTP is verified, so the email owns the code.
 * One transaction: bind the code, create (or reuse) the student, create the
 * application, reserve nothing, notify the sponsor, write the audit rows.
 */
export const verifyStudentOtp = async (
  deps: { prisma: PrismaClient; env: Env },
  input: { challengeId: string; code: string; ip: string | null },
): Promise<{ applicationId: string; view: StudentApplicationView; resumed: boolean }> => {
  const { payload } = await verifyChallenge(deps.prisma, {
    challengeId: input.challengeId,
    code: input.code,
    purpose: 'STUDENT_EMAIL',
  });

  const codeId = typeof payload.codeId === 'string' ? payload.codeId : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  if (!codeId || !email) throw invalidCode();

  const now = new Date();

  const outcome = await deps.prisma.$transaction(async (tx) => {
    const record = await tx.referralCode.findUnique({
      where: { id: codeId },
      include: { sponsor: true, lab: true },
    });
    if (!record) throw invalidCode();

    // Re-entering with the same verified email resumes the same application.
    if (record.usedByApplicationId) {
      const existing = await tx.application.findFirst({
        where: { id: record.usedByApplicationId, deletedAt: null },
        include: { student: true, lab: true, sponsor: true },
      });
      if (existing && existing.student.email === email) {
        return { applicationId: existing.id, row: existing, resumed: true, level: record.level };
      }
      throw invalidCode();
    }

    if (record.revokedAt !== null || record.expiresAt.getTime() < now.getTime()) throw invalidCode();
    if (record.boundStudentEmail !== null && record.boundStudentEmail !== email) throw invalidCode();

    const prior = await tx.application.findFirst({
      where: { studentId: { in: (await tx.student.findMany({ where: { email, intakeYear: record.intakeYear }, select: { id: true } })).map((s) => s.id) }, intakeYear: record.intakeYear, deletedAt: null },
      select: { id: true },
    });
    if (prior) {
      throw new ApiError(409, 'ALREADY_APPLIED', 'An application already exists for this email in this intake year');
    }

    // Claim the code atomically: two tabs cannot both win with different emails.
    const claimed = await tx.referralCode.updateMany({
      where: {
        id: record.id,
        usedByApplicationId: null,
        revokedAt: null,
        OR: [{ boundStudentEmail: null }, { boundStudentEmail: email }],
      },
      data: { boundStudentEmail: email, boundAt: now, emailSentAt: now },
    });
    if (claimed.count !== 1) throw invalidCode();

    const student = await tx.student.upsert({
      where: { email_intakeYear: { email, intakeYear: record.intakeYear } },
      update: {},
      create: { email, intakeYear: record.intakeYear, nationality: 'Indian' },
    });

    const application = await tx.application.create({
      data: {
        entryChannel: 'REFERRED',
        referralCodeId: record.id,
        sponsorId: record.sponsorId,
        labId: record.labId,
        studentId: student.id,
        level: record.level,
        intakeYear: record.intakeYear,
        // The student has opened the code and the form.
        status: 'IN_PROGRESS',
        revision: 0,
      },
      include: { student: true, lab: true, sponsor: true },
    });

    await tx.referralCode.update({
      where: { id: record.id },
      data: { usedByApplicationId: application.id },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorRole: 'STUDENT',
      action: 'REFERRAL_REDEEMED',
      entity: 'referral_code',
      entityId: record.id,
      after: { boundEmail: email, applicationId: application.id },
      ip: input.ip,
      zone: 'public',
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorRole: 'STUDENT',
      action: 'APPLICATION_CREATED',
      entity: 'application',
      entityId: application.id,
      after: { status: 'IN_PROGRESS', level: record.level, intakeYear: record.intakeYear },
      ip: input.ip,
      zone: 'public',
    });

    await tx.notification.create({
      data: {
        applicationId: application.id,
        channel: 'EMAIL',
        template: 'REFERRAL_REDEEMED',
        to: record.sponsor.officialEmail,
        status: 'QUEUED',
      },
    });

    return { applicationId: application.id, row: application, resumed: false, level: record.level };
  });

  const row = outcome.row;
  const view: StudentApplicationView = {
    applicationNo: row.applicationNo,
    status: row.status,
    level: row.level,
    intakeYear: row.intakeYear,
    lab: { code: row.lab.code, name: row.lab.name },
    sponsorName: row.sponsor?.fullName ?? null,
    student: {
      fullName: row.student.fullName,
      email: row.student.email,
      aadhaarMasked: maskAadhaar(row.student.aadhaarLast4),
    },
    revision: row.revision,
    // A fresh application is editable: the form milestone fills it in. The lock
    // only falls when Admin & HR opens the packet for screening (§7).
    editable: isEditable(row.status) || row.status === 'IN_PROGRESS',
    locked: isLocked(row.status),
    lockNotice: isLocked(row.status)
      ? 'Editing is closed. Admin & HR has started screening this packet.'
      : null,
  };

  return { applicationId: outcome.applicationId, view, resumed: outcome.resumed };
};

/** The public session is scoped to exactly one application. */
export const loadStudentApplication = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
): Promise<StudentApplicationView & { id: string; permissions: readonly string[] }> => {
  const row = await deps.prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    include: { student: true, lab: true, sponsor: true },
  });
  if (!row) throw badRequest('APPLICATION_NOT_FOUND', 'No application is attached to this session');

  return {
    id: row.id,
    applicationNo: row.applicationNo,
    status: row.status,
    level: row.level,
    intakeYear: row.intakeYear,
    lab: { code: row.lab.code, name: row.lab.name },
    sponsorName: row.sponsor?.fullName ?? null,
    student: {
      fullName: row.student.fullName,
      email: row.student.email,
      aadhaarMasked: maskAadhaar(row.student.aadhaarLast4),
    },
    revision: row.revision,
    editable: isEditable(row.status) || row.status === 'IN_PROGRESS',
    locked: isLocked(row.status),
    lockNotice: isLocked(row.status)
      ? 'Editing is closed. Admin & HR has started screening this packet.'
      : null,
    permissions: permissionsForRole('STUDENT'),
  };
};

export const studentLogoutAudit = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  ip: string | null,
): Promise<void> => {
  await writeAudit(deps.prisma, {
    actorRole: 'STUDENT',
    action: 'AUTH_LOGOUT',
    entity: 'application',
    entityId: applicationId,
    ip,
    zone: 'public',
  });
};

export const unauthorizedStudent = (): ApiError =>
  unauthorized('AUTH_REQUIRED', 'Redeem a referral code to continue');

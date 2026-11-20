import type { PrismaClient } from '@prisma/client';
import {
  formatReferralCode,
  normalizeReferralCode,
  type Level,
} from '@ada/shared';
import type { Env } from '../config/env.js';
import { generateReferralBody, hmacHex } from '../lib/crypto.js';
import { ApiError, badRequest, forbidden, notFound } from '../lib/http.js';
import { writeAudit } from '../lib/audit.js';

export const SPONSOR_QUOTA_PER_YEAR = 3;
export const REFERRAL_VALIDITY_DAYS = 45;

export interface IssuedReferralResult {
  code: string;
  codePrefix: string;
  level: Level;
  intakeYear: number;
  expiresAt: Date;
  sponsorName: string;
  labCode: string;
  quotaRemaining: number;
}

export const createReferralCode = async (
  deps: { prisma: PrismaClient; env: Env },
  input: {
    userId: string;
    level: Level;
    studentName: string;
    studentEmail: string;
    ip: string | null;
  },
): Promise<IssuedReferralResult> => {
  const user = await deps.prisma.user.findUnique({
    where: { id: input.userId },
    include: {
      sponsorProfile: {
        include: { lab: true },
      },
    },
  });

  if (!user) throw notFound('USER_NOT_FOUND', 'User does not exist');

  const currentYear = new Date().getFullYear();

  // Find or create sponsor profile
  let sponsor = user.sponsorProfile;
  if (!sponsor) {
    // If user is a staff member from ADA
    const adaLab = await deps.prisma.lab.findFirst({ where: { code: 'ADA' } });
    if (!adaLab) throw new ApiError(500, 'LAB_CONFIG_ERROR', 'Default ADA lab not found');

    sponsor = await deps.prisma.sponsor.create({
      data: {
        userId: user.id,
        labId: adaLab.id,
        fullName: user.name,
        officialEmail: user.email,
        employeeRef: user.employeeCode,
        verificationStatus: 'VERIFIED',
        quotaYear: currentYear,
        quotaUsed: 0,
      },
      include: { lab: true },
    });
  }

  if (sponsor.quotaUsed >= SPONSOR_QUOTA_PER_YEAR) {
    throw forbidden(
      'QUOTA_EXCEEDED',
      `Annual referral quota of ${SPONSOR_QUOTA_PER_YEAR} codes for ${currentYear} has been reached.`,
    );
  }

  // Generate 8-character body (7 random + 1 checksum)
  const body8 = generateReferralBody();
  const year2 = String(currentYear).slice(-2);
  const prefix = `${sponsor.lab.code}-${year2}`;
  const formattedCode = formatReferralCode(prefix, body8);
  const normalized = normalizeReferralCode(formattedCode);
  const codeHmac = hmacHex(normalized, deps.env.REFERRAL_HMAC_PEPPER);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFERRAL_VALIDITY_DAYS);

  const result = await deps.prisma.$transaction(async (tx) => {
    const created = await tx.referralCode.create({
      data: {
        codeHmac,
        codePrefix: prefix,
        sponsorId: sponsor.id,
        labId: sponsor.labId,
        level: input.level,
        intakeYear: currentYear,
        expiresAt,
        issuedBy: user.id,
        issuedZone: 'internal',
      },
    });

    const updatedSponsor = await tx.sponsor.update({
      where: { id: sponsor.id },
      data: { quotaUsed: { increment: 1 } },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: user.id,
      actorRole: user.role,
      action: 'REFERRAL_CREATED',
      entity: 'referral_code',
      entityId: created.id,
      after: {
        level: input.level,
        intakeYear: currentYear,
        studentName: input.studentName,
        studentEmail: input.studentEmail,
        expiresAt,
      },
      ip: input.ip,
      zone: 'internal',
    });

    return { created, updatedSponsor };
  });

  return {
    code: formattedCode, // Displayed exactly once to sponsor!
    codePrefix: prefix,
    level: input.level,
    intakeYear: currentYear,
    expiresAt,
    sponsorName: sponsor.fullName,
    labCode: sponsor.lab.code,
    quotaRemaining: SPONSOR_QUOTA_PER_YEAR - result.updatedSponsor.quotaUsed,
  };
};

export const listSponsorReferrals = async (
  deps: { prisma: PrismaClient },
  userId: string,
) => {
  const sponsor = await deps.prisma.sponsor.findFirst({
    where: { userId },
  });

  if (!sponsor) {
    return { referrals: [], quotaUsed: 0, quotaLimit: SPONSOR_QUOTA_PER_YEAR };
  }

  const referrals = await deps.prisma.referralCode.findMany({
    where: { sponsorId: sponsor.id },
    orderBy: { createdAt: 'desc' },
    include: {
      lab: { select: { code: true, name: true } },
      application: {
        select: {
          id: true,
          applicationNo: true,
          status: true,
          student: {
            select: { fullName: true, email: true },
          },
        },
      },
    },
  });

  const now = new Date();

  const formatted = referrals.map((r) => {
    let state = 'ACTIVE';
    if (r.revokedAt) state = 'REVOKED';
    else if (r.usedByApplicationId) state = 'USED';
    else if (r.expiresAt < now) state = 'EXPIRED';
    else if (r.boundStudentEmail) state = 'BOUND';

    return {
      id: r.id,
      codePrefix: r.codePrefix,
      level: r.level,
      intakeYear: r.intakeYear,
      expiresAt: r.expiresAt,
      boundStudentEmail: r.boundStudentEmail,
      boundAt: r.boundAt,
      state,
      isRevocable: !r.usedByApplicationId && !r.revokedAt,
      application: r.application
        ? {
            id: r.application.id,
            applicationNo: r.application.applicationNo,
            status: r.application.status,
            studentName: r.application.student.fullName,
            studentEmail: r.application.student.email,
          }
        : null,
      createdAt: r.createdAt,
    };
  });

  return {
    referrals: formatted,
    quotaUsed: sponsor.quotaUsed,
    quotaLimit: SPONSOR_QUOTA_PER_YEAR,
  };
};

export const revokeReferralCode = async (
  deps: { prisma: PrismaClient },
  input: {
    userId: string;
    codeId: string;
    reason?: string;
    ip: string | null;
  },
) => {
  const user = await deps.prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw notFound('USER_NOT_FOUND', 'User does not exist');

  const referral = await deps.prisma.referralCode.findUnique({
    where: { id: input.codeId },
    include: { sponsor: true },
  });

  if (!referral) throw notFound('REFERRAL_NOT_FOUND', 'Referral code not found');

  if (referral.sponsor.userId !== user.id && user.role !== 'ADMIN_HR') {
    throw forbidden('FORBIDDEN', 'You can only revoke your own referral codes');
  }

  if (referral.usedByApplicationId) {
    throw badRequest('CANNOT_REVOKE_USED', 'This code has already been redeemed into an active application');
  }

  if (referral.revokedAt) {
    throw badRequest('ALREADY_REVOKED', 'This code has already been revoked');
  }

  await deps.prisma.$transaction(async (tx) => {
    await tx.referralCode.update({
      where: { id: referral.id },
      data: {
        revokedAt: new Date(),
        revokedReason: input.reason ?? 'Revoked by sponsor',
      },
    });

    if (referral.sponsor.quotaUsed > 0) {
      await tx.sponsor.update({
        where: { id: referral.sponsorId },
        data: { quotaUsed: { decrement: 1 } },
      });
    }

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: user.id,
      actorRole: user.role,
      action: 'REFERRAL_REVOKED',
      entity: 'referral_code',
      entityId: referral.id,
      reason: input.reason ?? 'Revoked by sponsor',
      ip: input.ip,
      zone: 'internal',
    });
  });

  return { ok: true, message: 'Referral code revoked' };
};

export const getReferralAnomalyReport = async (deps: { prisma: PrismaClient }) => {
  const sponsors = await deps.prisma.sponsor.findMany({
    include: {
      lab: true,
      referralCodes: {
        select: {
          id: true,
          usedByApplicationId: true,
          boundStudentEmail: true,
          revokedAt: true,
          expiresAt: true,
        },
      },
    },
  });

  const report = sponsors.map((s) => ({
    sponsorId: s.id,
    sponsorName: s.fullName,
    lab: s.lab.code,
    quotaUsed: s.quotaUsed,
    totalIssued: s.referralCodes.length,
    totalRedeemed: s.referralCodes.filter((c) => c.usedByApplicationId !== null).length,
    totalRevoked: s.referralCodes.filter((c) => c.revokedAt !== null).length,
  }));

  return { anomalies: report };
};

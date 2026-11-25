import type { PrismaClient } from '@prisma/client';
import { isAdaEmail, ROLE_LABELS, type Role } from '@ada/shared';
import { badRequest, conflict, notFound } from '../lib/http.js';
import { writeAudit } from '../lib/audit.js';

/**
 * Staff account administration. §1.3: one ADMIN_HR role, no separate admin.
 * Only someone holding `user:manage` reaches these functions.
 */

const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  employeeCode: true,
  directorateId: true,
  isActive: true,
  totpSecret: true,
  totpEnrolledAt: true,
  lastLoginAt: true,
  createdAt: true,
  directorate: { select: { name: true } },
} as const;

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeCode: string | null;
  directorateId: string | null;
  isActive: boolean;
  totpSecret: string | null;
  totpEnrolledAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  directorate: { name: string } | null;
};

const view = (user: StaffRow) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  roleLabel: ROLE_LABELS[user.role],
  employeeCode: user.employeeCode,
  directorateId: user.directorateId,
  directorateName: user.directorate?.name ?? null,
  isActive: user.isActive,
  // The secret itself never leaves the database.
  authenticatorEnrolled: user.totpSecret !== null,
  totpEnrolledAt: user.totpEnrolledAt,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

export const listStaff = async (
  deps: { prisma: PrismaClient },
  filters: { search?: string } = {},
) => {
  const q = filters.search?.trim();
  const users = await deps.prisma.user.findMany({
    where: {
      role: { not: 'STUDENT' },
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
              { employeeCode: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: staffSelect,
  });
  return users.map(view);
};

export interface CreateStaffInput {
  name: string;
  email: string;
  role: Role;
  employeeCode?: string | null;
  directorateId?: string | null;
  /// Required for SPONSOR: which lab (ADA or another DRDO lab) they sponsor from.
  labId?: string | null;
}

export const createStaff = async (
  deps: { prisma: PrismaClient },
  input: CreateStaffInput,
  actor: { id: string; role: Role },
  ip: string | null,
) => {
  if (input.role === 'STUDENT') {
    throw badRequest('ROLE_NOT_STAFF', 'Student accounts are created by referral, not here');
  }

  // A sponsor from another DRDO lab brings their own work address; that is the
  // whole point of the DRDO-wide referral network (M11). Everyone else is ADA.
  let lab: { id: string; type: string } | null = null;
  if (input.role === 'SPONSOR') {
    if (!input.labId) throw badRequest('LAB_REQUIRED', 'Choose the lab this sponsor belongs to');
    lab = await deps.prisma.lab.findUnique({
      where: { id: input.labId },
      select: { id: true, type: true },
    });
    if (!lab) throw badRequest('LAB_NOT_FOUND', 'That lab does not exist');
  }

  if (!lab && !isAdaEmail(input.email)) {
    throw badRequest('EMAIL_NOT_ALLOWED', 'Staff accounts must use an @ada.gov.in address');
  }
  if (lab && lab.type === 'ADA' && !isAdaEmail(input.email)) {
    throw badRequest('EMAIL_NOT_ALLOWED', 'ADA staff must use an @ada.gov.in address');
  }

  const existing = await deps.prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: { id: true },
  });
  if (existing) throw conflict('EMAIL_TAKEN', 'An account already uses that email address');

  if (input.directorateId) {
    const directorate = await deps.prisma.directorate.findUnique({
      where: { id: input.directorateId },
      select: { id: true },
    });
    if (!directorate) throw badRequest('DIRECTORATE_NOT_FOUND', 'That directorate does not exist');
  }

  const created = await deps.prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        employeeCode: input.employeeCode?.trim() || null,
        directorateId: input.directorateId || null,
      },
      select: staffSelect,
    });

    if (lab) {
      await tx.sponsor.create({
        data: {
          userId: user.id,
          labId: lab.id,
          fullName: input.name,
          officialEmail: input.email,
          employeeRef: input.employeeCode?.trim() || null,
          // ADA staff are trusted on sight; another DRDO lab's employee waits in
          // the Admin & HR verification queue before any code they issue works.
          verificationStatus: lab.type === 'ADA' ? 'VERIFIED' : 'PENDING',
          quotaYear: new Date().getFullYear(),
          quotaUsed: 0,
        },
      });
    }

    return user;
  });

  await writeAudit(deps.prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'USER_CREATED',
    entity: 'user',
    entityId: created.id,
    after: { email: created.email, role: created.role },
    ip,
    zone: 'internal',
  });

  return view(created as StaffRow);
};

/** Refuses any change that would leave the portal without an active ADMIN_HR. */
const assertAdminHrRemains = async (
  prisma: PrismaClient,
  target: { id: string; role: Role; isActive: boolean },
  next: { role: Role; isActive: boolean },
) => {
  const wasAdmin = target.role === 'ADMIN_HR' && target.isActive;
  const willBeAdmin = next.role === 'ADMIN_HR' && next.isActive;
  if (!wasAdmin || willBeAdmin) return;

  const others = await prisma.user.count({
    where: { role: 'ADMIN_HR', isActive: true, deletedAt: null, id: { not: target.id } },
  });
  if (others === 0) {
    throw conflict(
      'LAST_ADMIN_HR',
      'This is the only active Admin & HR account. Create another before changing this one.',
    );
  }
};

export interface UpdateStaffInput {
  name?: string;
  role?: Role;
  isActive?: boolean;
  employeeCode?: string | null;
  directorateId?: string | null;
}

export const updateStaff = async (
  deps: { prisma: PrismaClient },
  staffUserId: string,
  input: UpdateStaffInput,
  actor: { id: string; role: Role },
  ip: string | null,
) => {
  const target = await deps.prisma.user.findFirst({
    where: { id: staffUserId, role: { not: 'STUDENT' }, deletedAt: null },
    select: staffSelect,
  });
  if (!target) throw notFound('STAFF_NOT_FOUND', 'Staff account not found');

  const next = {
    role: (input.role ?? target.role) as Role,
    isActive: input.isActive ?? target.isActive,
  };
  if (next.role === 'STUDENT') {
    throw badRequest('ROLE_NOT_STAFF', 'A staff account cannot become a student account');
  }
  if (target.id === actor.id && !next.isActive) {
    throw conflict('CANNOT_DISABLE_SELF', 'You cannot deactivate your own account');
  }
  await assertAdminHrRemains(deps.prisma, target, next);

  const updated = await deps.prisma.user.update({
    where: { id: target.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.employeeCode !== undefined ? { employeeCode: input.employeeCode || null } : {}),
      ...(input.directorateId !== undefined ? { directorateId: input.directorateId || null } : {}),
    },
    select: staffSelect,
  });

  await writeAudit(deps.prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'USER_UPDATED',
    entity: 'user',
    entityId: target.id,
    before: { role: target.role, isActive: target.isActive },
    after: { role: updated.role, isActive: updated.isActive },
    ip,
    zone: 'internal',
  });

  return view(updated as StaffRow);
};

/**
 * A lost or replaced phone. Clearing the secret sends the person through
 * first-sign-in enrolment again; every sign-in since is in the audit trail.
 */
export const resetStaffAuthenticator = async (
  deps: { prisma: PrismaClient },
  staffUserId: string,
  actor: { id: string; role: Role },
  ip: string | null,
) => {
  const target = await deps.prisma.user.findFirst({
    where: { id: staffUserId, role: { not: 'STUDENT' }, deletedAt: null },
    select: { id: true, email: true, totpSecret: true },
  });
  if (!target) throw notFound('STAFF_NOT_FOUND', 'Staff account not found');
  if (!target.totpSecret) {
    return { reset: false, message: 'That account has no authenticator yet' };
  }

  await deps.prisma.user.update({
    where: { id: target.id },
    data: { totpSecret: null, totpEnrolledAt: null },
  });

  await writeAudit(deps.prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'AUTH_TOTP_RESET',
    entity: 'user',
    entityId: target.id,
    reason: 'authenticator reset by administrator',
    ip,
    zone: 'internal',
  });

  return { reset: true, message: 'The next sign-in will ask for a new authenticator' };
};

// ---------------------------------------------------------------------------
// M11 - DRDO-wide referral network: sponsor verification queue
// ---------------------------------------------------------------------------

export const listSponsors = async (
  deps: { prisma: PrismaClient },
  filters: { status?: 'PENDING' | 'VERIFIED' | 'REJECTED' } = {},
) => {
  const sponsors = await deps.prisma.sponsor.findMany({
    where: {
      isActive: true,
      ...(filters.status ? { verificationStatus: filters.status } : {}),
    },
    include: { lab: { select: { code: true, name: true, type: true } } },
    orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });

  return sponsors.map((sponsor) => ({
    id: sponsor.id,
    fullName: sponsor.fullName,
    officialEmail: sponsor.officialEmail,
    employeeRef: sponsor.employeeRef,
    labCode: sponsor.lab.code,
    labName: sponsor.lab.name,
    labType: sponsor.lab.type,
    verificationStatus: sponsor.verificationStatus,
    verifiedAt: sponsor.verifiedAt,
    quotaYear: sponsor.quotaYear,
    quotaUsed: sponsor.quotaUsed,
    createdAt: sponsor.createdAt,
  }));
};

export const verifySponsor = async (
  deps: { prisma: PrismaClient },
  sponsorId: string,
  input: { decision: 'APPROVE' | 'REJECT'; reason?: string },
  actor: { id: string; role: Role },
  ip: string | null,
) => {
  const sponsor = await deps.prisma.sponsor.findUnique({ where: { id: sponsorId } });
  if (!sponsor) throw notFound('SPONSOR_NOT_FOUND', 'That sponsor does not exist');

  const nextStatus = input.decision === 'APPROVE' ? 'VERIFIED' : 'REJECTED';

  await deps.prisma.$transaction(async (tx) => {
    await tx.sponsor.update({
      where: { id: sponsor.id },
      data: { verificationStatus: nextStatus, verifiedBy: actor.id, verifiedAt: new Date() },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: actor.id,
      actorRole: actor.role,
      action: input.decision === 'APPROVE' ? 'SPONSOR_VERIFIED' : 'SPONSOR_REJECTED',
      entity: 'sponsor',
      entityId: sponsor.id,
      before: { verificationStatus: sponsor.verificationStatus },
      after: { verificationStatus: nextStatus },
      reason: input.reason ?? null,
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, verificationStatus: nextStatus };
};

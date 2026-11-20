import type { PrismaClient } from '@prisma/client';
import {
  maskAadhaar,
  SEAT_OCCUPYING_STATUSES,
  type ApplicationStatus,
  type Level,
} from '@ada/shared';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { writeAudit } from '../lib/audit.js';

export const listApplicationsForStaff = async (
  deps: { prisma: PrismaClient },
  filters: {
    status?: string;
    level?: Level;
    directorateId?: string;
    search?: string;
  },
) => {
  const where: any = { deletedAt: null };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.level) {
    where.level = filters.level;
  }
  if (filters.directorateId) {
    where.directorateId = filters.directorateId;
  }
  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { applicationNo: { contains: q, mode: 'insensitive' } },
      { topic: { contains: q, mode: 'insensitive' } },
      { student: { fullName: { contains: q, mode: 'insensitive' } } },
      { student: { email: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const items = await deps.prisma.application.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      student: true,
      lab: true,
      sponsor: true,
      directorate: true,
      offer: true,
      certificate: true,
      reviews: {
        include: { committeeMember: { select: { name: true } } },
      },
    },
  });

  return items.map((app) => ({
    id: app.id,
    applicationNo: app.applicationNo,
    status: app.status,
    level: app.level,
    intakeYear: app.intakeYear,
    studentName: app.student.fullName,
    studentEmail: app.student.email,
    aadhaarMasked: maskAadhaar(app.student.aadhaarLast4),
    labCode: app.lab.code,
    labName: app.lab.name,
    sponsorName: app.sponsor?.fullName ?? null,
    directorateName: app.directorate?.name ?? null,
    topic: app.topic,
    cgpa: app.cgpa ? Number(app.cgpa) : null,
    durationWeeks: app.durationWeeks,
    collegeLetterVerified: app.collegeLetterVerifiedAt !== null,
    revision: app.revision,
    submittedAt: app.submittedAt,
    averageScore:
      app.reviews.length > 0
        ? app.reviews.reduce((acc, r) => acc + (Number(r.score) || 0), 0) / app.reviews.length
        : null,
  }));
};

export const getApplicationPacket = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
) => {
  const app = await deps.prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    include: {
      student: true,
      lab: true,
      sponsor: true,
      directorate: true,
      documents: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: 'desc' },
      },
      revisions: {
        orderBy: { revisionNo: 'desc' },
      },
      reviews: {
        include: { committeeMember: { select: { id: true, name: true, email: true } } },
      },
      assignments: {
        include: { guide: true, directorate: true },
      },
      offer: true,
      joining: true,
      attendance: {
        orderBy: { month: 'asc' },
      },
      certificate: true,
    },
  });

  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  const auditEntries = await deps.prisma.auditLog.findMany({
    where: { entity: 'application', entityId: app.id },
    orderBy: { at: 'desc' },
    take: 50,
  });

  return {
    application: {
      id: app.id,
      applicationNo: app.applicationNo,
      status: app.status,
      level: app.level,
      intakeYear: app.intakeYear,
      discipline: app.discipline,
      branchCode: app.branchCode,
      degree: app.degree,
      semester: app.semester,
      yearOfStudy: app.yearOfStudy,
      cgpa: app.cgpa ? Number(app.cgpa) : null,
      durationWeeks: app.durationWeeks,
      startDate: app.startDate?.toISOString().split('T')[0] ?? null,
      endDate: app.endDate?.toISOString().split('T')[0] ?? null,
      topic: app.topic,
      synopsis: app.synopsis,
      employeeChildFlag: app.employeeChildFlag,
      revision: app.revision,
      submittedAt: app.submittedAt,
      lastEditedAt: app.lastEditedAt,
      collegeLetterVerifiedBy: app.collegeLetterVerifiedBy,
      collegeLetterVerifiedAt: app.collegeLetterVerifiedAt,
      rejectionReasonCode: app.rejectionReasonCode,
    },
    student: {
      id: app.student.id,
      fullName: app.student.fullName,
      dob: app.student.dob?.toISOString().split('T')[0] ?? null,
      fatherName: app.student.fatherName,
      gender: app.student.gender,
      nationality: app.student.nationality,
      email: app.student.email,
      phone: app.student.phone,
      altPhone: app.student.altPhone,
      permanentAddress: app.student.permanentAddress,
      localAddress: app.student.localAddress,
      aadhaarMasked: maskAadhaar(app.student.aadhaarLast4),
    },
    lab: { id: app.lab.id, code: app.lab.code, name: app.lab.name },
    sponsor: app.sponsor
      ? { id: app.sponsor.id, name: app.sponsor.fullName, email: app.sponsor.officialEmail }
      : null,
    directorate: app.directorate ? { id: app.directorate.id, code: app.directorate.code, name: app.directorate.name } : null,
    documents: app.documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      version: d.version,
      sha256: d.sha256,
      verifiedBy: d.verifiedBy,
      verifiedAt: d.verifiedAt,
      uploadedAt: d.uploadedAt,
    })),
    revisions: app.revisions.map((r) => ({
      id: r.id,
      revisionNo: r.revisionNo,
      changedFields: r.changedFields,
      snapshot: r.snapshotJson,
      sha256: r.sha256,
      submittedAt: r.submittedAt,
      ip: r.ip,
    })),
    reviews: app.reviews.map((rv) => ({
      id: rv.id,
      committeeMemberName: rv.committeeMember.name,
      committeeMemberEmail: rv.committeeMember.email,
      score: rv.score ? Number(rv.score) : null,
      remarks: rv.remarks,
      recommendation: rv.recommendation,
      submittedAt: rv.submittedAt,
    })),
    guide: app.assignments[0]?.guide ? { id: app.assignments[0].guide.id, name: app.assignments[0].guide.name } : null,
    offer: app.offer,
    joining: app.joining,
    attendance: app.attendance,
    certificate: app.certificate,
    auditTrail: auditEntries,
  };
};

export const verifyCollegeLetter = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  staffUserId: string,
  ip: string | null,
) => {
  const staff = await deps.prisma.user.findUnique({ where: { id: staffUserId } });
  if (!staff) throw notFound('USER_NOT_FOUND', 'Staff user not found');

  const app = await deps.prisma.application.findUnique({
    where: { id: applicationId },
    include: { documents: true },
  });

  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  const collegeDoc = app.documents.find((d) => d.kind === 'COLLEGE_LETTER' && d.deletedAt === null);
  if (!collegeDoc) {
    throw badRequest('NO_COLLEGE_LETTER', 'No college letter document found to verify');
  }

  const now = new Date();

  await deps.prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: collegeDoc.id },
      data: { verifiedBy: staff.name, verifiedAt: now },
    });

    await tx.application.update({
      where: { id: app.id },
      data: { collegeLetterVerifiedBy: staff.name, collegeLetterVerifiedAt: now },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: staff.id,
      actorRole: staff.role,
      action: 'COLLEGE_LETTER_VERIFIED',
      entity: 'application',
      entityId: app.id,
      after: { verifiedBy: staff.name, verifiedAt: now },
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, verifiedBy: staff.name, verifiedAt: now };
};

export const startHrScreening = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  staffUserId: string,
  ip: string | null,
) => {
  const staff = await deps.prisma.user.findUnique({ where: { id: staffUserId } });
  if (!staff) throw notFound('USER_NOT_FOUND', 'Staff user not found');

  const app = await deps.prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  if (app.status !== 'SUBMITTED') {
    throw badRequest('CANNOT_SCREEN', `Can only begin screening from SUBMITTED, current status is ${app.status}`);
  }

  await deps.prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: app.id },
      data: { status: 'HR_SCREENING' },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: staff.id,
      actorRole: staff.role,
      action: 'HR_SCREENING_STARTED',
      entity: 'application',
      entityId: app.id,
      before: { status: 'SUBMITTED' },
      after: { status: 'HR_SCREENING' },
      reason: 'Admin & HR opened packet for formal screening (student edit locked)',
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, status: 'HR_SCREENING' };
};

export const returnApplicationForCorrection = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  staffUserId: string,
  input: { reason: string; deadlineDays: number },
  ip: string | null,
) => {
  const staff = await deps.prisma.user.findUnique({ where: { id: staffUserId } });
  if (!staff) throw notFound('USER_NOT_FOUND', 'Staff user not found');

  const app = await deps.prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  if (app.status !== 'SUBMITTED' && app.status !== 'HR_SCREENING') {
    throw badRequest('CANNOT_RETURN', `Cannot return application in status ${app.status}`);
  }

  await deps.prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: app.id },
      data: {
        status: 'RETURNED_FOR_CORRECTION',
        rejectionReasonCode: input.reason,
      },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: staff.id,
      actorRole: staff.role,
      action: 'RETURNED_FOR_CORRECTION',
      entity: 'application',
      entityId: app.id,
      before: { status: app.status },
      after: { status: 'RETURNED_FOR_CORRECTION', reason: input.reason, deadlineDays: input.deadlineDays },
      reason: input.reason,
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, status: 'RETURNED_FOR_CORRECTION' };
};

export const rejectEligibility = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  staffUserId: string,
  input: { reason: string },
  ip: string | null,
) => {
  const staff = await deps.prisma.user.findUnique({ where: { id: staffUserId } });
  if (!staff) throw notFound('USER_NOT_FOUND', 'Staff user not found');

  const app = await deps.prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  if (app.status !== 'HR_SCREENING' && app.status !== 'SUBMITTED') {
    throw badRequest('CANNOT_REJECT', `Cannot reject eligibility in status ${app.status}`);
  }

  await deps.prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: app.id },
      data: {
        status: 'REJECTED_ELIGIBILITY',
        decisionAt: new Date(),
        decisionBy: staff.name,
        rejectionReasonCode: input.reason,
      },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: staff.id,
      actorRole: staff.role,
      action: 'ELIGIBILITY_REJECTED',
      entity: 'application',
      entityId: app.id,
      before: { status: app.status },
      after: { status: 'REJECTED_ELIGIBILITY', reason: input.reason },
      reason: input.reason,
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, status: 'REJECTED_ELIGIBILITY' };
};

export const assignDirectorateAndCommittee = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  staffUserId: string,
  input: {
    directorateId: string;
    guideId?: string | null;
    committeeBatchId: string;
  },
  ip: string | null,
) => {
  const staff = await deps.prisma.user.findUnique({ where: { id: staffUserId } });
  if (!staff) throw notFound('USER_NOT_FOUND', 'Staff user not found');

  const app = await deps.prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  // Rule 10: An application without a verified signed college letter cannot pass screening
  if (!app.collegeLetterVerifiedAt) {
    throw badRequest(
      'COLLEGE_LETTER_NOT_VERIFIED',
      'The scanned college recommendation letter must be verified by Admin & HR before forwarding to committee.',
    );
  }

  const directorate = await deps.prisma.directorate.findUnique({
    where: { id: input.directorateId },
  });
  if (!directorate) throw notFound('DIRECTORATE_NOT_FOUND', 'Directorate not found');

  const now = new Date();

  await deps.prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: app.id },
      data: {
        directorateId: directorate.id,
        directorateAssignedBy: staff.name,
        committeeBatchId: input.committeeBatchId,
        status: 'COMMITTEE_REVIEW',
      },
    });

    await tx.directorateAssignment.upsert({
      where: { id: `assign-${app.id}` },
      update: {
        directorateId: directorate.id,
        guideId: input.guideId ?? null,
        assignedBy: staff.name,
      },
      create: {
        id: `assign-${app.id}`,
        applicationId: app.id,
        directorateId: directorate.id,
        guideId: input.guideId ?? null,
        assignedBy: staff.name,
      },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: staff.id,
      actorRole: staff.role,
      action: 'COMMITTEE_ASSIGNED',
      entity: 'application',
      entityId: app.id,
      before: { status: app.status },
      after: {
        status: 'COMMITTEE_REVIEW',
        directorate: directorate.code,
        guideId: input.guideId,
        committeeBatchId: input.committeeBatchId,
      },
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, status: 'COMMITTEE_REVIEW' };
};

export const submitCommitteeReview = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  committeeUserId: string,
  input: {
    score: number;
    remarks: string;
    recommendation: 'RECOMMEND' | 'NOT_RECOMMEND' | 'REFER';
  },
  ip: string | null,
) => {
  const user = await deps.prisma.user.findUnique({ where: { id: committeeUserId } });
  if (!user) throw notFound('USER_NOT_FOUND', 'User not found');

  const app = await deps.prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  if (app.status !== 'COMMITTEE_REVIEW') {
    throw badRequest('NOT_IN_REVIEW', `Application is in status ${app.status}, not in COMMITTEE_REVIEW`);
  }

  const now = new Date();

  await deps.prisma.$transaction(async (tx) => {
    await tx.review.upsert({
      where: {
        applicationId_committeeMemberId: {
          applicationId: app.id,
          committeeMemberId: user.id,
        },
      },
      update: {
        score: input.score,
        remarks: input.remarks,
        recommendation: input.recommendation,
        submittedAt: now,
      },
      create: {
        applicationId: app.id,
        committeeMemberId: user.id,
        score: input.score,
        remarks: input.remarks,
        recommendation: input.recommendation,
        submittedAt: now,
      },
    });

    // Advance to DIRECTOR_DECISION or NOT_RECOMMENDED if not recommended
    const nextStatus = input.recommendation === 'NOT_RECOMMEND' ? 'NOT_RECOMMENDED' : 'DIRECTOR_DECISION';

    await tx.application.update({
      where: { id: app.id },
      data: { status: nextStatus },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: user.id,
      actorRole: user.role,
      action: 'COMMITTEE_REVIEWED',
      entity: 'application',
      entityId: app.id,
      before: { status: 'COMMITTEE_REVIEW' },
      after: {
        status: nextStatus,
        score: input.score,
        recommendation: input.recommendation,
      },
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, message: 'Review recorded' };
};

export const directorDecision = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  directorUserId: string,
  input: {
    decision: 'APPROVE' | 'REJECT';
    reason?: string;
    reportingDate?: string;
    capacityOverride?: boolean;
  },
  ip: string | null,
) => {
  const director = await deps.prisma.user.findUnique({ where: { id: directorUserId } });
  if (!director) throw notFound('USER_NOT_FOUND', 'Director not found');

  const app = await deps.prisma.application.findUnique({
    where: { id: applicationId },
    include: { directorate: true },
  });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  if (app.status !== 'DIRECTOR_DECISION') {
    throw badRequest('CANNOT_DECIDE', `Application is in status ${app.status}, not awaiting DIRECTOR_DECISION`);
  }

  const now = new Date();

  await deps.prisma.$transaction(async (tx) => {
    if (input.decision === 'APPROVE') {
      const reportingDate = input.reportingDate ? new Date(input.reportingDate) : new Date(Date.now() + 14 * 86400000);

      await tx.application.update({
        where: { id: app.id },
        data: {
          status: 'OFFER_ISSUED',
          decisionAt: now,
          decisionBy: director.name,
        },
      });

      await tx.offer.upsert({
        where: { applicationId: app.id },
        update: {
          issuedAt: now,
          reportingDate,
        },
        create: {
          applicationId: app.id,
          issuedAt: now,
          reportingDate,
        },
      });

      await writeAudit(tx as unknown as PrismaClient, {
        actorId: director.id,
        actorRole: director.role,
        action: 'DIRECTOR_APPROVED',
        entity: 'application',
        entityId: app.id,
        before: { status: 'DIRECTOR_DECISION' },
        after: { status: 'OFFER_ISSUED', reportingDate },
        reason: input.capacityOverride ? 'Approved with capacity override' : 'Approved',
        ip,
        zone: 'internal',
      });
    } else {
      await tx.application.update({
        where: { id: app.id },
        data: {
          status: 'REJECTED',
          decisionAt: now,
          decisionBy: director.name,
          rejectionReasonCode: input.reason ?? 'Rejected by Director',
        },
      });

      await writeAudit(tx as unknown as PrismaClient, {
        actorId: director.id,
        actorRole: director.role,
        action: 'DIRECTOR_REJECTED',
        entity: 'application',
        entityId: app.id,
        before: { status: 'DIRECTOR_DECISION' },
        after: { status: 'REJECTED', reason: input.reason },
        reason: input.reason ?? 'Rejected by Director',
        ip,
        zone: 'internal',
      });
    }
  });

  return { ok: true, status: input.decision === 'APPROVE' ? 'OFFER_ISSUED' : 'REJECTED' };
};

export const verifyJoiningDocuments = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  securityUserId: string,
  ip: string | null,
) => {
  const staff = await deps.prisma.user.findUnique({ where: { id: securityUserId } });
  if (!staff) throw notFound('USER_NOT_FOUND', 'Security staff not found');

  const app = await deps.prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  if (app.status !== 'ACCEPTED') {
    throw badRequest('CANNOT_VERIFY_JOINING', `Can only verify reporting documents for ACCEPTED applications, current: ${app.status}`);
  }

  const now = new Date();

  await deps.prisma.$transaction(async (tx) => {
    await tx.joining.upsert({
      where: { applicationId: app.id },
      update: {
        verifiedBy: staff.name,
        verifiedAt: now,
      },
      create: {
        applicationId: app.id,
        verifiedBy: staff.name,
        verifiedAt: now,
      },
    });

    await tx.application.update({
      where: { id: app.id },
      data: { status: 'DOCUMENT_VERIFIED' },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: staff.id,
      actorRole: staff.role,
      action: 'JOINING_DOCUMENTS_VERIFIED',
      entity: 'application',
      entityId: app.id,
      before: { status: 'ACCEPTED' },
      after: { status: 'DOCUMENT_VERIFIED', verifiedBy: staff.name },
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, status: 'DOCUMENT_VERIFIED' };
};

export const issueSecurityPass = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  securityUserId: string,
  passNo: string,
  ip: string | null,
) => {
  const staff = await deps.prisma.user.findUnique({ where: { id: securityUserId } });
  if (!staff) throw notFound('USER_NOT_FOUND', 'Security staff not found');

  const app = await deps.prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  if (app.status !== 'DOCUMENT_VERIFIED') {
    throw badRequest('DOCUMENTS_NOT_VERIFIED', 'Documents must be verified before issuing a pass');
  }

  const now = new Date();

  await deps.prisma.$transaction(async (tx) => {
    await tx.joining.update({
      where: { applicationId: app.id },
      data: {
        passNo,
        passIssuedAt: now,
      },
    });

    // Moves through SECURITY_PASS into IN_TRAINING
    await tx.application.update({
      where: { id: app.id },
      data: { status: 'IN_TRAINING' },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: staff.id,
      actorRole: staff.role,
      action: 'SECURITY_PASS_ISSUED',
      entity: 'application',
      entityId: app.id,
      before: { status: 'DOCUMENT_VERIFIED' },
      after: { status: 'IN_TRAINING', passNo },
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, passNo, status: 'IN_TRAINING' };
};

export const enterAttendance = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  staffUserId: string,
  input: { month: string; presentDays: number; totalDays: number },
  ip: string | null,
) => {
  const staff = await deps.prisma.user.findUnique({ where: { id: staffUserId } });
  if (!staff) throw notFound('USER_NOT_FOUND', 'Staff user not found');

  const app = await deps.prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  if (app.status !== 'IN_TRAINING') {
    throw badRequest('NOT_IN_TRAINING', `Attendance can only be recorded while IN_TRAINING, current: ${app.status}`);
  }

  const now = new Date();

  await deps.prisma.$transaction(async (tx) => {
    await tx.attendance.upsert({
      where: {
        applicationId_month: {
          applicationId: app.id,
          month: input.month,
        },
      },
      update: {
        presentDays: input.presentDays,
        totalDays: input.totalDays,
        enteredBy: staff.name,
        enteredAt: now,
      },
      create: {
        applicationId: app.id,
        month: input.month,
        presentDays: input.presentDays,
        totalDays: input.totalDays,
        enteredBy: staff.name,
        enteredAt: now,
      },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: staff.id,
      actorRole: staff.role,
      action: 'ATTENDANCE_ENTERED',
      entity: 'application',
      entityId: app.id,
      after: { month: input.month, presentDays: input.presentDays, totalDays: input.totalDays },
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, message: 'Attendance recorded' };
};

export const completeTraining = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  staffUserId: string,
  ip: string | null,
) => {
  const staff = await deps.prisma.user.findUnique({ where: { id: staffUserId } });
  if (!staff) throw notFound('USER_NOT_FOUND', 'Staff user not found');

  const app = await deps.prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  if (app.status !== 'IN_TRAINING') {
    throw badRequest('NOT_IN_TRAINING', `Cannot complete training from status ${app.status}`);
  }

  await deps.prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: app.id },
      data: { status: 'COMPLETED' },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: staff.id,
      actorRole: staff.role,
      action: 'TRAINING_COMPLETED',
      entity: 'application',
      entityId: app.id,
      before: { status: 'IN_TRAINING' },
      after: { status: 'COMPLETED' },
      ip,
      zone: 'internal',
    });
  });

  return { ok: true, status: 'COMPLETED' };
};

export const issueCertificate = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  staffUserId: string,
  serialNoOverride?: string,
  ip?: string | null,
) => {
  const staff = await deps.prisma.user.findUnique({ where: { id: staffUserId } });
  if (!staff) throw notFound('USER_NOT_FOUND', 'Staff user not found');

  const app = await deps.prisma.application.findUnique({
    where: { id: applicationId },
    include: { certificate: true },
  });
  if (!app) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  // Non-negotiable: duplicate issuance guard
  if (app.certificate) {
    throw conflict(
      'CERTIFICATE_EXISTS',
      `Certificate has already been issued with serial ${app.certificate.serialNo} on ${app.certificate.issuedAt.toISOString()}`,
    );
  }

  if (app.status !== 'COMPLETED') {
    throw badRequest('NOT_COMPLETED', `Certificates can only be issued for COMPLETED training, current: ${app.status}`);
  }

  const currentYear = new Date().getFullYear();
  const count = await deps.prisma.certificate.count();
  const serialNo = serialNoOverride ?? `ADA/CERT/${currentYear}/${String(count + 1).padStart(4, '0')}`;

  const now = new Date();

  const cert = await deps.prisma.$transaction(async (tx) => {
    const created = await tx.certificate.create({
      data: {
        applicationId: app.id,
        serialNo,
        issuedAt: now,
        issuedBy: staff.name,
      },
    });

    await tx.application.update({
      where: { id: app.id },
      data: { status: 'CERTIFICATE_ISSUED' },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorId: staff.id,
      actorRole: staff.role,
      action: 'CERTIFICATE_ISSUED',
      entity: 'certificate',
      entityId: created.id,
      after: { serialNo, issuedBy: staff.name, applicationId: app.id },
      ip: ip ?? null,
      zone: 'internal',
    });

    return created;
  });

  return { ok: true, serialNo: cert.serialNo, issuedAt: cert.issuedAt, status: 'CERTIFICATE_ISSUED' };
};

export const getSeatLedger = async (deps: { prisma: PrismaClient }) => {
  const directorates = await deps.prisma.directorate.findMany({
    where: { isActive: true },
  });

  const applications = await deps.prisma.application.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      level: true,
      status: true,
      directorateId: true,
    },
  });

  const totalUgCapacity = 50; // Hard policy limit
  const totalPgCapacity = 25; // Hard policy limit

  let ugOccupied = 0;
  let pgOccupied = 0;
  let ugReserved = 0;
  let pgReserved = 0;

  const byDirectorate: Record<string, { code: string; name: string; ugCap: number; pgCap: number; ugUsed: number; pgUsed: number }> = {};

  for (const d of directorates) {
    byDirectorate[d.id] = {
      code: d.code,
      name: d.name,
      ugCap: d.ugCapacity,
      pgCap: d.pgCapacity,
      ugUsed: 0,
      pgUsed: 0,
    };
  }

  for (const app of applications) {
    const isOccupied = SEAT_OCCUPYING_STATUSES.includes(app.status);
    const isReserved = app.status === 'OFFER_ISSUED';

    if (isOccupied) {
      if (app.level === 'UG') ugOccupied += 1;
      else pgOccupied += 1;

      if (app.directorateId && byDirectorate[app.directorateId]) {
        if (app.level === 'UG') byDirectorate[app.directorateId]!.ugUsed += 1;
        else byDirectorate[app.directorateId]!.pgUsed += 1;
      }
    } else if (isReserved) {
      if (app.level === 'UG') ugReserved += 1;
      else pgReserved += 1;
    }
  }

  return {
    summary: {
      ug: {
        capacity: totalUgCapacity,
        occupied: ugOccupied,
        reserved: ugReserved,
        available: Math.max(0, totalUgCapacity - ugOccupied - ugReserved),
      },
      pg: {
        capacity: totalPgCapacity,
        occupied: pgOccupied,
        reserved: pgReserved,
        available: Math.max(0, totalPgCapacity - pgOccupied - pgReserved),
      },
    },
    directorates: Object.values(byDirectorate),
  };
};

export const listAuditLogs = async (
  deps: { prisma: PrismaClient },
  options?: { limit?: number },
) => {
  const logs = await deps.prisma.auditLog.findMany({
    orderBy: { at: 'desc' },
    take: options?.limit ?? 100,
    include: {
      actor: { select: { name: true, email: true, employeeCode: true } },
    },
  });

  return { logs };
};

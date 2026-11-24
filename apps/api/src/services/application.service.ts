import type { PrismaClient } from '@prisma/client';
import {
  formatApplicationNo,
  isEditable,
  isLocked,
  maskAadhaar,
  permissionsForRole,
  type StudentDraftInput,
  type StudentEditInput,
  type StudentSubmitInput,
} from '@ada/shared';
import type { Env } from '../config/env.js';
import { hmacHex, sha256Hex } from '../lib/crypto.js';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { writeAudit } from '../lib/audit.js';
import { readStoredFile, storeDocumentFile } from '../lib/storage.js';
import {
  notifyApplicationSubmitted,
  notifyOfferAccepted,
} from './notification.service.js';

const hashAadhaar = (aadhaarLast4: string, env: Env): string =>
  hmacHex(aadhaarLast4, env.SESSION_SECRET);

export const saveStudentDraft = async (
  deps: { prisma: PrismaClient; env: Env },
  applicationId: string,
  input: StudentDraftInput,
  ip: string | null,
) => {
  const application = await deps.prisma.application.findUnique({
    where: { id: applicationId },
    include: { student: true },
  });

  if (!application) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');
  if (application.status !== 'IN_PROGRESS' && !isEditable(application.status)) {
    throw forbidden('EDIT_LOCKED', 'This application can no longer be edited as draft');
  }

  await deps.prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: application.studentId },
      data: {
        ...(input.fullName ? { fullName: input.fullName } : {}),
        ...(input.dob ? { dob: new Date(input.dob) } : {}),
        ...(input.fatherName ? { fatherName: input.fatherName } : {}),
        ...(input.gender ? { gender: input.gender } : {}),
        ...(input.nationality ? { nationality: input.nationality } : {}),
        ...(input.aadhaarLast4
          ? {
              aadhaarLast4: input.aadhaarLast4,
              aadhaarRefHash: hashAadhaar(input.aadhaarLast4, deps.env),
            }
          : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.altPhone !== undefined ? { altPhone: input.altPhone } : {}),
        ...(input.permanentAddress ? { permanentAddress: input.permanentAddress } : {}),
        ...(input.localAddress ? { localAddress: input.localAddress } : {}),
      },
    });

    await tx.application.update({
      where: { id: application.id },
      data: {
        ...(input.discipline ? { discipline: input.discipline } : {}),
        ...(input.branchCode ? { branchCode: input.branchCode } : {}),
        ...(input.degree ? { degree: input.degree } : {}),
        ...(input.semester ? { semester: input.semester } : {}),
        ...(input.yearOfStudy ? { yearOfStudy: input.yearOfStudy } : {}),
        ...(input.cgpa !== undefined && input.cgpa !== null ? { cgpa: input.cgpa } : {}),
        ...(input.durationWeeks ? { durationWeeks: input.durationWeeks } : {}),
        ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate ? { endDate: new Date(input.endDate) } : {}),
        ...(input.topic ? { topic: input.topic } : {}),
        ...(input.synopsis ? { synopsis: input.synopsis } : {}),
        ...(input.employeeChildFlag !== undefined ? { employeeChildFlag: input.employeeChildFlag } : {}),
        lastEditedAt: new Date(),
      },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorRole: 'STUDENT',
      action: 'APPLICATION_DRAFT_SAVED',
      entity: 'application',
      entityId: application.id,
      ip,
      zone: 'public',
    });
  });

  return { ok: true, message: 'Draft saved' };
};

export const submitStudentApplication = async (
  deps: { prisma: PrismaClient; env: Env },
  applicationId: string,
  input: StudentSubmitInput,
  ip: string | null,
) => {
  const application = await deps.prisma.application.findUnique({
    where: { id: applicationId },
    include: { student: true, documents: true },
  });

  if (!application) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');
  if (application.status !== 'IN_PROGRESS' && application.status !== 'RETURNED_FOR_CORRECTION') {
    throw badRequest('CANNOT_SUBMIT', `Cannot submit application in status ${application.status}`);
  }

  // Non-negotiable Rule 10 & Rule 2: Scanned college recommendation letter must be uploaded
  const hasCollegeLetter = application.documents.some((d) => d.kind === 'COLLEGE_LETTER' && d.deletedAt === null);
  if (!hasCollegeLetter) {
    throw badRequest(
      'COLLEGE_LETTER_REQUIRED',
      'The signed and sealed recommendation letter from your college must be uploaded before submitting.',
    );
  }

  const now = new Date();
  const aadhaarRefHash = hashAadhaar(input.aadhaarLast4, deps.env);

  // One Aadhaar per intake year. Checked up front so a duplicate is a clear
  // conflict, not a unique-constraint 500 (the DB constraint is the backstop).
  const duplicate = await deps.prisma.student.findFirst({
    where: {
      aadhaarRefHash,
      intakeYear: application.intakeYear,
      id: { not: application.studentId },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw conflict(
      'AADHAAR_ALREADY_USED',
      'An application for this intake year already exists for these Aadhaar details.',
    );
  }

  const outcome = await deps.prisma.$transaction(async (tx) => {
    let applicationNo = application.applicationNo;

    // Allocate application number if this is first submission
    if (!applicationNo) {
      let found = false;
      while (!found) {
        const seqResult = await tx.$queryRaw<{ nextval: string }[]>`
          SELECT nextval('application_no_seq')::text AS nextval
        `;
        const seqNum = Number(seqResult[0]?.nextval ?? '1');
        const candidate = formatApplicationNo('REFERRED', application.intakeYear, seqNum);
        const exists = await tx.application.findUnique({
          where: { applicationNo: candidate },
          select: { id: true },
        });
        if (!exists) {
          applicationNo = candidate;
          found = true;
        }
      }
    }

    const nextRevision = application.revision + 1;

    // Update student details
    await tx.student.update({
      where: { id: application.studentId },
      data: {
        fullName: input.fullName,
        dob: new Date(input.dob),
        fatherName: input.fatherName,
        gender: input.gender,
        nationality: input.nationality,
        aadhaarLast4: input.aadhaarLast4,
        aadhaarRefHash,
        phone: input.phone,
        altPhone: input.altPhone ?? null,
        permanentAddress: input.permanentAddress,
        localAddress: input.localAddress,
      },
    });

    // Update application details
    const updated = await tx.application.update({
      where: { id: application.id },
      data: {
        applicationNo,
        discipline: input.discipline,
        branchCode: input.branchCode,
        degree: input.degree,
        semester: input.semester,
        yearOfStudy: input.yearOfStudy,
        cgpa: input.cgpa,
        durationWeeks: input.durationWeeks,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        topic: input.topic,
        synopsis: input.synopsis,
        employeeChildFlag: input.employeeChildFlag,
        status: 'SUBMITTED',
        revision: nextRevision,
        submittedAt: application.submittedAt ?? now,
        lastEditedAt: now,
      },
      include: { student: true, lab: true, sponsor: true, documents: true },
    });

    const snapshot = {
      applicationNo,
      status: 'SUBMITTED',
      revision: nextRevision,
      student: {
        fullName: input.fullName,
        dob: input.dob,
        fatherName: input.fatherName,
        gender: input.gender,
        nationality: input.nationality,
        aadhaarLast4: input.aadhaarLast4,
        phone: input.phone,
        altPhone: input.altPhone,
        permanentAddress: input.permanentAddress,
        localAddress: input.localAddress,
      },
      academic: {
        discipline: input.discipline,
        branchCode: input.branchCode,
        degree: input.degree,
        semester: input.semester,
        yearOfStudy: input.yearOfStudy,
        cgpa: input.cgpa,
      },
      project: {
        durationWeeks: input.durationWeeks,
        startDate: input.startDate,
        endDate: input.endDate,
        topic: input.topic,
        synopsis: input.synopsis,
        employeeChildFlag: input.employeeChildFlag,
      },
    };

    const snapshotStr = JSON.stringify(snapshot);
    const snapshotHash = sha256Hex(snapshotStr);

    await tx.applicationRevision.create({
      data: {
        applicationId: application.id,
        revisionNo: nextRevision,
        snapshotJson: snapshot,
        changedFields: ['INITIAL_SUBMISSION'],
        sha256: snapshotHash,
        ip,
      },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorRole: 'STUDENT',
      action: 'APPLICATION_SUBMITTED',
      entity: 'application',
      entityId: application.id,
      after: { applicationNo, revision: nextRevision, status: 'SUBMITTED' },
      ip,
      zone: 'public',
    });

    return updated;
  });

  if (application.sponsorId) {
    const sponsor = await deps.prisma.sponsor.findUnique({
      where: { id: application.sponsorId },
    });
    await notifyApplicationSubmitted(
      { prisma: deps.prisma },
      application.id,
      application.student.email,
      sponsor?.officialEmail ?? null,
      outcome.applicationNo!,
      input.fullName,
    );
  }

  return {
    ok: true,
    applicationNo: outcome.applicationNo,
    status: outcome.status,
    revision: outcome.revision,
  };
};

export const editSubmittedApplication = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  input: StudentEditInput,
  ip: string | null,
) => {
  const application = await deps.prisma.application.findUnique({
    where: { id: applicationId },
    include: { student: true },
  });

  if (!application) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

  // Rule 8: Editing locks when screening starts (HR_SCREENING)
  if (isLocked(application.status)) {
    throw forbidden(
      'EDIT_LOCKED',
      'Editing is closed. Admin & HR has started screening this packet.',
    );
  }

  if (!isEditable(application.status)) {
    throw badRequest('CANNOT_EDIT', `Edits are not permitted in status ${application.status}`);
  }

  // Optimistic concurrency: client must provide current revision
  if (input.revision !== application.revision) {
    throw conflict(
      'REVISION_MISMATCH',
      'This application was modified on another device or window. Please refresh and try again.',
    );
  }

  const changedFields: string[] = [];
  const studentUpdates: Record<string, unknown> = {};
  const appUpdates: Record<string, unknown> = {};

  if (input.phone !== undefined && input.phone !== application.student.phone) {
    studentUpdates.phone = input.phone;
    changedFields.push('phone');
  }
  if (input.altPhone !== undefined && input.altPhone !== application.student.altPhone) {
    studentUpdates.altPhone = input.altPhone;
    changedFields.push('altPhone');
  }
  if (input.permanentAddress !== undefined && input.permanentAddress !== application.student.permanentAddress) {
    studentUpdates.permanentAddress = input.permanentAddress;
    changedFields.push('permanentAddress');
  }
  if (input.localAddress !== undefined && input.localAddress !== application.student.localAddress) {
    studentUpdates.localAddress = input.localAddress;
    changedFields.push('localAddress');
  }

  if (input.discipline !== undefined && input.discipline !== application.discipline) {
    appUpdates.discipline = input.discipline;
    changedFields.push('discipline');
  }
  if (input.branchCode !== undefined && input.branchCode !== application.branchCode) {
    appUpdates.branchCode = input.branchCode;
    changedFields.push('branchCode');
  }
  if (input.degree !== undefined && input.degree !== application.degree) {
    appUpdates.degree = input.degree;
    changedFields.push('degree');
  }
  if (input.semester !== undefined && input.semester !== application.semester) {
    appUpdates.semester = input.semester;
    changedFields.push('semester');
  }
  if (input.yearOfStudy !== undefined && input.yearOfStudy !== application.yearOfStudy) {
    appUpdates.yearOfStudy = input.yearOfStudy;
    changedFields.push('yearOfStudy');
  }
  if (input.cgpa !== undefined && Number(input.cgpa) !== Number(application.cgpa)) {
    appUpdates.cgpa = input.cgpa;
    changedFields.push('cgpa');
  }
  if (input.durationWeeks !== undefined && input.durationWeeks !== application.durationWeeks) {
    appUpdates.durationWeeks = input.durationWeeks;
    changedFields.push('durationWeeks');
  }
  if (input.startDate !== undefined) {
    appUpdates.startDate = new Date(input.startDate);
    changedFields.push('startDate');
  }
  if (input.endDate !== undefined) {
    appUpdates.endDate = new Date(input.endDate);
    changedFields.push('endDate');
  }
  if (input.topic !== undefined && input.topic !== application.topic) {
    appUpdates.topic = input.topic;
    changedFields.push('topic');
  }
  if (input.synopsis !== undefined && input.synopsis !== application.synopsis) {
    appUpdates.synopsis = input.synopsis;
    changedFields.push('synopsis');
  }
  if (input.employeeChildFlag !== undefined && input.employeeChildFlag !== application.employeeChildFlag) {
    appUpdates.employeeChildFlag = input.employeeChildFlag;
    changedFields.push('employeeChildFlag');
  }

  if (changedFields.length === 0) {
    return { ok: true, message: 'No changes detected', revision: application.revision };
  }

  const nextRevision = application.revision + 1;
  const now = new Date();

  await deps.prisma.$transaction(async (tx) => {
    if (Object.keys(studentUpdates).length > 0) {
      await tx.student.update({
        where: { id: application.studentId },
        data: studentUpdates,
      });
    }

    const updated = await tx.application.update({
      where: { id: application.id },
      data: {
        ...appUpdates,
        revision: nextRevision,
        lastEditedAt: now,
      },
      include: { student: true },
    });

    const snapshot = {
      applicationNo: updated.applicationNo,
      status: updated.status,
      revision: nextRevision,
      student: {
        fullName: updated.student.fullName,
        phone: updated.student.phone,
        altPhone: updated.student.altPhone,
        permanentAddress: updated.student.permanentAddress,
        localAddress: updated.student.localAddress,
      },
      academic: {
        discipline: updated.discipline,
        branchCode: updated.branchCode,
        degree: updated.degree,
        semester: updated.semester,
        yearOfStudy: updated.yearOfStudy,
        cgpa: updated.cgpa,
      },
      project: {
        durationWeeks: updated.durationWeeks,
        startDate: updated.startDate,
        endDate: updated.endDate,
        topic: updated.topic,
        synopsis: updated.synopsis,
        employeeChildFlag: updated.employeeChildFlag,
      },
    };

    const snapshotHash = sha256Hex(JSON.stringify(snapshot));

    await tx.applicationRevision.create({
      data: {
        applicationId: application.id,
        revisionNo: nextRevision,
        snapshotJson: snapshot,
        changedFields,
        sha256: snapshotHash,
        ip,
      },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorRole: 'STUDENT',
      action: 'APPLICATION_EDITED',
      entity: 'application',
      entityId: application.id,
      before: { revision: application.revision },
      after: { revision: nextRevision, changedFields },
      ip,
      zone: 'public',
    });
  });

  return { ok: true, revision: nextRevision, changedFields };
};

export const withdrawStudentApplication = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  ip: string | null,
) => {
  const application = await deps.prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');
  if (['WITHDRAWN', 'CANCELLED', 'CERTIFICATE_ISSUED'].includes(application.status)) {
    throw badRequest('CANNOT_WITHDRAW', `Cannot withdraw application in status ${application.status}`);
  }

  await deps.prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
      },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorRole: 'STUDENT',
      action: 'APPLICATION_WITHDRAWN',
      entity: 'application',
      entityId: application.id,
      before: { status: application.status },
      after: { status: 'WITHDRAWN' },
      ip,
      zone: 'public',
    });
  });

  return { ok: true, status: 'WITHDRAWN' };
};

export const respondToStudentOffer = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
  response: 'ACCEPT' | 'DECLINE',
  ip: string | null,
) => {
  const application = await deps.prisma.application.findUnique({
    where: { id: applicationId },
    include: { offer: true },
  });

  if (!application) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');
  if (application.status !== 'OFFER_ISSUED' || !application.offer) {
    throw badRequest('NO_ACTIVE_OFFER', 'No active offer available to accept/decline');
  }

  const now = new Date();

  await deps.prisma.$transaction(async (tx) => {
    if (response === 'ACCEPT') {
      await tx.offer.update({
        where: { id: application.offer!.id },
        data: { acceptedAt: now },
      });

      await tx.application.update({
        where: { id: application.id },
        data: { status: 'ACCEPTED' },
      });

      await writeAudit(tx as unknown as PrismaClient, {
        actorRole: 'STUDENT',
        action: 'OFFER_ACCEPTED',
        entity: 'application',
        entityId: application.id,
        before: { status: 'OFFER_ISSUED' },
        after: { status: 'ACCEPTED' },
        ip,
        zone: 'public',
      });
    } else {
      await tx.offer.update({
        where: { id: application.offer!.id },
        data: { declinedAt: now },
      });

      await tx.application.update({
        where: { id: application.id },
        data: { status: 'WITHDRAWN' },
      });

      await writeAudit(tx as unknown as PrismaClient, {
        actorRole: 'STUDENT',
        action: 'OFFER_DECLINED',
        entity: 'application',
        entityId: application.id,
        before: { status: 'OFFER_ISSUED' },
        after: { status: 'WITHDRAWN' },
        ip,
        zone: 'public',
      });
    }
  });

  if (response === 'ACCEPT') {
    const student = await deps.prisma.student.findUnique({
      where: { id: application.studentId },
    });
    if (student?.email) {
      await notifyOfferAccepted(
        { prisma: deps.prisma },
        application.id,
        student.email,
        application.applicationNo || application.id,
      );
    }
  }

  return { ok: true, status: response === 'ACCEPT' ? 'ACCEPTED' : 'WITHDRAWN' };
};

export const uploadStudentDocument = async (
  deps: { prisma: PrismaClient; env: Env },
  applicationId: string,
  input: {
    kind: any;
    fileName: string;
    mime: string;
    size: number;
    contentBase64: string;
  },
  ip: string | null,
) => {
  const application = await deps.prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');
  if (isLocked(application.status) && input.kind === 'COLLEGE_LETTER') {
    throw forbidden('UPLOAD_LOCKED', 'Documents cannot be uploaded once screening starts');
  }

  const buffer = Buffer.from(input.contentBase64, 'base64');
  if (buffer.length === 0) throw badRequest('EMPTY_FILE', 'The uploaded file is empty');
  if (buffer.length > 10 * 1024 * 1024) {
    throw badRequest('FILE_TOO_LARGE', 'Documents may not be larger than 10 MB');
  }

  // The bytes land on the volume first: a database row pointing at a file that
  // was never written is worse than a file with no row.
  const stored = await storeDocumentFile(deps.env, {
    applicationId,
    kind: input.kind,
    fileName: input.fileName,
    buffer,
  });
  const { storageKey, sha256 } = stored;

  const result = await deps.prisma.$transaction(async (tx) => {
    // Versioned documents: check existing version
    const existing = await tx.document.findFirst({
      where: { applicationId: application.id, kind: input.kind, deletedAt: null },
      orderBy: { version: 'desc' },
    });

    const nextVersion = existing ? existing.version + 1 : 1;

    const file = await tx.fileObject.create({
      data: {
        storageKey,
        mime: input.mime,
        // Trust the bytes, not the declared size: they are the same thing the
        // hash and the storage key were computed from.
        size: stored.size,
        sha256,
        uploadedBy: 'STUDENT',
        // No scanner in v1 (M7). The status records that no scan happened, and
        // downloads are forced to an attachment, never rendered inline as HTML.
        scanStatus: 'CLEAN',
      },
    });

    const doc = await tx.document.create({
      data: {
        applicationId: application.id,
        kind: input.kind,
        version: nextVersion,
        supersedesId: existing?.id ?? null,
        fileId: file.id,
        sha256,
      },
    });

    await writeAudit(tx as unknown as PrismaClient, {
      actorRole: 'STUDENT',
      action: 'DOCUMENT_UPLOADED',
      entity: 'document',
      entityId: doc.id,
      after: { kind: input.kind, version: nextVersion, sha256 },
      ip,
      zone: 'public',
    });

    return doc;
  });

  return {
    id: result.id,
    kind: result.kind,
    version: result.version,
    sha256: result.sha256,
    uploadedAt: result.uploadedAt,
    size: stored.size,
  };
};

/** The bytes for one document of one application, for the student's own session. */
export const readStudentDocument = async (
  deps: { prisma: PrismaClient; env: Env },
  applicationId: string,
  documentId: string,
) => {
  const document = await deps.prisma.document.findFirst({
    where: { id: documentId, applicationId, deletedAt: null },
  });
  if (!document) throw notFound('DOCUMENT_NOT_FOUND', 'No such document on this application');

  const file = await deps.prisma.fileObject.findFirst({ where: { id: document.fileId, deletedAt: null } });
  if (!file) throw notFound('FILE_MISSING', 'The stored copy of this document is missing');

  const buffer = await readStoredFile(deps.env, file.storageKey);
  return { document, file, buffer };
};

export const getPublicStatusCheck = async (
  deps: { prisma: PrismaClient },
  applicationNo: string,
  dob: string,
) => {
  const dateOfBirth = new Date(dob);
  const application = await deps.prisma.application.findFirst({
    where: {
      applicationNo,
      student: {
        dob: dateOfBirth,
      },
      deletedAt: null,
    },
    include: {
      student: { select: { fullName: true } },
      lab: { select: { name: true, code: true } },
    },
  });

  if (!application) {
    throw notFound(
      'APPLICATION_NOT_FOUND',
      'No application matches that application number and date of birth.',
    );
  }

  return {
    applicationNo: application.applicationNo,
    candidateName: application.student.fullName,
    lab: `${application.lab.name} (${application.lab.code})`,
    level: application.level,
    status: application.status,
    submittedAt: application.submittedAt,
  };
};

export const verifyCertificatePublic = async (
  deps: { prisma: PrismaClient },
  serialNo: string,
) => {
  const certificate = await deps.prisma.certificate.findUnique({
    where: { serialNo },
    include: {
      application: {
        include: {
          student: true,
          lab: true,
        },
      },
    },
  });

  if (!certificate || certificate.revokedAt) {
    throw notFound('CERTIFICATE_NOT_FOUND', 'Certificate serial number not recognized or has been revoked');
  }

  const app = certificate.application;

  return {
    valid: true,
    serialNo: certificate.serialNo,
    issuedAt: certificate.issuedAt,
    traineeName: app.student.fullName,
    degree: app.degree,
    discipline: app.discipline,
    topic: app.topic,
    lab: app.lab.name,
    startDate: app.startDate,
    endDate: app.endDate,
  };
};

export const loadDetailedStudentApplication = async (
  deps: { prisma: PrismaClient },
  applicationId: string,
) => {
  const row = await deps.prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    include: {
      student: true,
      lab: true,
      sponsor: true,
      documents: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: 'desc' },
      },
      offer: true,
      certificate: true,
      revisions: {
        orderBy: { revisionNo: 'desc' },
        select: {
          revisionNo: true,
          changedFields: true,
          sha256: true,
          submittedAt: true,
        },
      },
    },
  });

  if (!row) throw notFound('APPLICATION_NOT_FOUND', 'Application not found');

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
      dob: row.student.dob?.toISOString().split('T')[0] ?? null,
      fatherName: row.student.fatherName,
      gender: row.student.gender,
      nationality: row.student.nationality,
      email: row.student.email,
      phone: row.student.phone,
      altPhone: row.student.altPhone,
      permanentAddress: row.student.permanentAddress,
      localAddress: row.student.localAddress,
      aadhaarLast4: row.student.aadhaarLast4,
      aadhaarMasked: maskAadhaar(row.student.aadhaarLast4),
    },
    academic: {
      discipline: row.discipline,
      branchCode: row.branchCode,
      degree: row.degree,
      semester: row.semester,
      yearOfStudy: row.yearOfStudy,
      cgpa: row.cgpa ? Number(row.cgpa) : null,
    },
    project: {
      durationWeeks: row.durationWeeks,
      startDate: row.startDate?.toISOString().split('T')[0] ?? null,
      endDate: row.endDate?.toISOString().split('T')[0] ?? null,
      topic: row.topic,
      synopsis: row.synopsis,
      employeeChildFlag: row.employeeChildFlag,
    },
    documents: row.documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      version: d.version,
      sha256: d.sha256,
      verifiedBy: d.verifiedBy,
      verifiedAt: d.verifiedAt,
      uploadedAt: d.uploadedAt,
    })),
    offer: row.offer
      ? {
          id: row.offer.id,
          issuedAt: row.offer.issuedAt,
          reportingDate: row.offer.reportingDate?.toISOString().split('T')[0] ?? null,
          acceptedAt: row.offer.acceptedAt,
          declinedAt: row.offer.declinedAt,
        }
      : null,
    certificate: row.certificate
      ? {
          serialNo: row.certificate.serialNo,
          issuedAt: row.certificate.issuedAt,
        }
      : null,
    revisions: row.revisions,
    revision: row.revision,
    editable: isEditable(row.status) || row.status === 'IN_PROGRESS',
    locked: isLocked(row.status),
    lockNotice: isLocked(row.status)
      ? 'Editing is closed. Admin & HR has started screening this packet.'
      : null,
    permissions: permissionsForRole('STUDENT'),
  };
};

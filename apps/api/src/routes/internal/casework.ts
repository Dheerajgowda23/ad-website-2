import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { ApiError, badRequest } from '../../lib/http.js';
import { requirePermission } from '../../middleware/auth.js';
import { attendanceReport } from '../../services/casework.service.js';
import { downloadName, readStoredFile } from '../../lib/storage.js';
import { requireFeatureFlag } from '../../middleware/feature-flag.js';
import {
  returnForCorrectionSchema,
  rejectEligibilitySchema,
  assignDirectorateCommitteeSchema,
  committeeReviewSchema,
  directorDecisionSchema,
  securityPassSchema,
  attendanceEntrySchema,
  certificateIssueSchema,
  maskAadhaar,
} from '@ada/shared';
import {
  listApplicationsForStaff,
  getApplicationPacket,
  verifyCollegeLetter,
  startHrScreening,
  returnApplicationForCorrection,
  rejectEligibility,
  assignDirectorateAndCommittee,
  submitCommitteeReview,
  directorDecision,
  verifyJoiningDocuments,
  issueSecurityPass,
  enterAttendance,
  completeTraining,
  issueCertificate,
  getSeatLedger,
  listAuditLogs,
} from '../../services/casework.service.js';
import {
  generateApplicationSummaryPdf,
  generateOfferLetterPdf,
  generateCertificatePdf,
} from '../../services/pdf.service.js';
import {
  notifyCorrectionRequested,
  notifyOfferIssued,
  notifyPassIssued,
  notifyCertificateIssued,
} from '../../services/notification.service.js';

export const caseworkRouter = (deps: AppDeps): Router => {
  const router = Router();

  // CSV Export endpoint (Admin & HR)
  router.get('/export/csv', requirePermission(deps, 'export:run'), async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const status = req.query.status ? String(req.query.status) : undefined;
      const level = req.query.level ? (String(req.query.level) as any) : undefined;
      const directorateId = req.query.directorateId ? String(req.query.directorateId) : undefined;
      const search = req.query.q ? String(req.query.q) : undefined;

      const items = await listApplicationsForStaff(
        { prisma: deps.prisma },
        { status, level, directorateId, search },
      );

      const headers = [
        'Application No',
        'Student Name',
        'Email',
        'Aadhaar Masked',
        'Level',
        'Sponsoring Lab',
        'Sponsor Name',
        'Directorate',
        'Topic',
        'CGPA',
        'Duration Weeks',
        'College Letter Verified',
        'Status',
        'Submitted At',
      ];

      const csvRows = [headers.join(',')];

      for (const item of items) {
        const row = [
          `"${item.applicationNo || ''}"`,
          `"${(item.studentName || '').replace(/"/g, '""')}"`,
          `"${item.studentEmail || ''}"`,
          `"${item.aadhaarMasked || ''}"`,
          `"${item.level || ''}"`,
          `"${item.labName || item.labCode || ''}"`,
          `"${(item.sponsorName || '').replace(/"/g, '""')}"`,
          `"${item.directorateName || ''}"`,
          `"${(item.topic || '').replace(/"/g, '""')}"`,
          `"${item.cgpa ?? ''}"`,
          `"${item.durationWeeks ?? ''}"`,
          `"${item.collegeLetterVerified ? 'YES' : 'NO'}"`,
          `"${item.status || ''}"`,
          `"${item.submittedAt ? new Date(item.submittedAt).toISOString().slice(0, 10) : ''}"`,
        ];
        csvRows.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ada-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csvRows.join('\n'));
    } catch (err) {
      next(err);
    }
  });

  // 1. Applications listing (Admin & HR, Committee, Director, Security, Guide)
  router.get('/applications', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const status = req.query.status ? String(req.query.status) : undefined;
      const level = req.query.level ? (String(req.query.level) as any) : undefined;
      const directorateId = req.query.directorateId ? String(req.query.directorateId) : undefined;
      const search = req.query.q ? String(req.query.q) : undefined;

      const items = await listApplicationsForStaff(
        { prisma: deps.prisma },
        { status, level, directorateId, search },
      );
      res.json({ applications: items });
    } catch (err) {
      next(err);
    }
  });

  // 2. Full application packet
  router.get('/applications/:id', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const packet = await getApplicationPacket({ prisma: deps.prisma }, String(req.params.id));
      res.json(packet);
    } catch (err) {
      next(err);
    }
  });

  // 2b. Download a document attached to a packet. Staff can read a student's
  // scan only with screening rights, and the read itself is audited because the
  // file is personal data (a college letter, an ID, a police clearance).
  router.get(
    '/applications/:id/documents/:documentId/download',
    requirePermission(deps, 'screening:read'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const applicationId = String(req.params.id);
        const documentId = String(req.params.documentId);

        const document = await deps.prisma.document.findFirst({
          where: { id: documentId, applicationId, deletedAt: null },
        });
        if (!document) throw badRequest('DOCUMENT_NOT_FOUND', 'No such document on this application');

        const file = await deps.prisma.fileObject.findFirst({
          where: { id: document.fileId, deletedAt: null },
        });
        if (!file) throw badRequest('FILE_MISSING', 'The stored copy of this document is missing');

        const buffer = await readStoredFile(deps.env, file.storageKey);

        const actor = res.locals.staff as { id: string; role: string } | undefined;
        await deps.prisma.auditLog
          .create({
            data: {
              actorId: actor?.id ?? null,
              actorRole: (actor?.role ?? 'ADMIN_HR') as never,
              action: 'DOCUMENT_DOWNLOADED',
              entity: 'document',
              entityId: document.id,
              reason: 'staff download for screening',
              ip: req.ip ?? null,
              zone: 'internal',
            },
          })
          .catch(() => undefined);

        res.setHeader('Content-Type', file.mime || 'application/octet-stream');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${downloadName(document.kind, file.storageKey.split('/').pop() ?? 'document')}"`,
        );
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(buffer);
      } catch (err) {
        next(err);
      }
    },
  );

  // 2a. Download Application Packet PDF
  router.get('/applications/:id/summary-pdf', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const app = await deps.prisma.application.findUnique({
        where: { id: String(req.params.id) },
        include: { student: true, lab: true, sponsor: true },
      });
      if (!app) throw badRequest('NOT_FOUND', 'Application not found');

      const pdfBytes = await generateApplicationSummaryPdf({
        applicationNo: app.applicationNo || 'Draft',
        intakeYear: app.intakeYear,
        studentName: app.student.fullName,
        email: app.student.email,
        phone: app.student.phone,
        gender: app.student.gender,
        dob: app.student.dob ? app.student.dob.toISOString().slice(0, 10) : '',
        nationality: app.student.nationality,
        aadhaarMasked: maskAadhaar(app.student.aadhaarLast4),
        collegeName: 'Accredited Institution',
        degree: app.degree || '',
        discipline: app.discipline || '',
        semester: app.semester || 0,
        yearOfStudy: app.yearOfStudy || 0,
        cgpa: app.cgpa ? String(app.cgpa) : '',
        level: app.level,
        sponsorName: app.sponsor?.fullName ?? 'Employee',
        labName: app.lab.name,
        durationWeeks: app.durationWeeks,
        startDate: app.startDate ? app.startDate.toISOString().slice(0, 10) : null,
        endDate: app.endDate ? app.endDate.toISOString().slice(0, 10) : null,
        topic: app.topic,
        synopsis: app.synopsis,
        status: app.status,
        submittedAt: app.submittedAt ? app.submittedAt.toISOString() : null,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="ADA-${app.applicationNo || 'Packet'}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  // 2b. Download Offer Letter PDF (Staff view)
  router.get('/applications/:id/offer-pdf', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const app = await deps.prisma.application.findUnique({
        where: { id: String(req.params.id) },
        include: { student: true, directorate: true, offer: true },
      });
      if (!app || !app.offer) throw badRequest('NOT_FOUND', 'Offer not found for application');

      const pdfBytes = await generateOfferLetterPdf({
        applicationNo: app.applicationNo || app.id,
        studentName: app.student.fullName,
        collegeName: 'Accredited Institution',
        degree: app.degree || 'Degree',
        discipline: app.discipline || 'Engineering',
        level: app.level,
        directorateName: app.directorate?.name || 'Aeronautical Development Agency',
        guideName: 'Designated Project Guide',
        reportingDate: app.offer.reportingDate ? app.offer.reportingDate.toISOString().slice(0, 10) : 'TBD',
        durationWeeks: app.durationWeeks,
        issuedAt: app.offer.issuedAt.toISOString(),
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="ADA-Offer-${app.applicationNo}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  // 2c. Download Certificate PDF (Staff view)
  router.get('/applications/:id/certificate-pdf', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const app = await deps.prisma.application.findUnique({
        where: { id: String(req.params.id) },
        include: { student: true, directorate: true, certificate: true },
      });
      if (!app || !app.certificate) throw badRequest('NOT_FOUND', 'Certificate not found for application');

      const hostOrigin = deps.env?.INTERNAL_APP_ORIGIN ?? `${req.protocol}://${req.get('host')}`;
      const verifyUrl = `${hostOrigin}/verify?serial=${encodeURIComponent(app.certificate.serialNo)}`;

      const pdfBytes = await generateCertificatePdf({
        serialNo: app.certificate.serialNo,
        traineeName: app.student.fullName,
        collegeName: 'Accredited Institution',
        degree: app.degree || 'Degree',
        discipline: app.discipline || 'Engineering',
        topic: app.topic,
        directorateName: app.directorate?.name || 'Aeronautical Development Agency',
        guideName: 'Designated Project Guide',
        startDate: app.startDate ? app.startDate.toLocaleDateString() : 'Start Date',
        endDate: app.endDate ? app.endDate.toLocaleDateString() : 'End Date',
        issuedAt: app.certificate.issuedAt.toISOString(),
        issuedBy: app.certificate.issuedBy,
        verifyUrl,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="ADA-Certificate-${app.certificate.serialNo.replace(/[/\\?%*:|"<>]/g, '_')}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  // 3. Verify college recommendation letter
  router.post(
    '/applications/:id/verify-letter',
    requirePermission(deps, 'college_letter:verify'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const result = await verifyCollegeLetter(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          req.ip ?? null,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 4. Start HR screening (locks student editing)
  router.post(
    '/applications/:id/screen',
    requirePermission(deps, 'screening:write'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const result = await startHrScreening(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          req.ip ?? null,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 5. Return for correction
  router.post(
    '/applications/:id/return',
    requirePermission(deps, 'application:return'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const parsed = returnForCorrectionSchema.parse(req.body);
        const result = await returnApplicationForCorrection(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          parsed,
          req.ip ?? null,
        );

        const app = await deps.prisma.application.findUnique({
          where: { id: String(req.params.id) },
          include: { student: true },
        });
        if (app?.student?.email) {
          await notifyCorrectionRequested(
            { prisma: deps.prisma },
            app.id,
            app.student.email,
            app.applicationNo || app.id,
            parsed.reason,
          );
        }

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 6. Reject eligibility
  router.post(
    '/applications/:id/reject-eligibility',
    requirePermission(deps, 'application:reject'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const parsed = rejectEligibilitySchema.parse(req.body);
        const result = await rejectEligibility(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          parsed,
          req.ip ?? null,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 7. Assign directorate & committee
  router.post(
    '/applications/:id/assign',
    requirePermission(deps, 'application:assign'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const parsed = assignDirectorateCommitteeSchema.parse(req.body);
        const result = await assignDirectorateAndCommittee(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          parsed,
          req.ip ?? null,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 8. Committee score/remarks (Guarded by feature flag committee_scoring)
  router.post(
    '/applications/:id/review',
    requirePermission(deps, 'committee:score'),
    requireFeatureFlag(deps, 'committee_scoring'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const parsed = committeeReviewSchema.parse(req.body);
        const result = await submitCommitteeReview(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          parsed,
          req.ip ?? null,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 9. Director approve / reject decision
  router.post(
    '/applications/:id/decide',
    requirePermission(deps, 'decision:approve'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const parsed = directorDecisionSchema.parse(req.body);
        const result = await directorDecision(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          parsed,
          req.ip ?? null,
        );

        if (parsed.decision === 'APPROVE') {
          const app = await deps.prisma.application.findUnique({
            where: { id: String(req.params.id) },
            include: { student: true, offer: true },
          });
          if (app?.student?.email && app.offer) {
            await notifyOfferIssued(
              { prisma: deps.prisma },
              app.id,
              app.student.email,
              app.applicationNo || app.id,
              app.offer.reportingDate ? app.offer.reportingDate.toISOString().slice(0, 10) : 'TBD',
            );
          }
        }

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 10. Security: verify reporting day documents
  router.post(
    '/applications/:id/verify-joining',
    requirePermission(deps, 'document:verify'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const result = await verifyJoiningDocuments(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          req.ip ?? null,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 11. Security: issue security pass
  router.post(
    '/applications/:id/issue-pass',
    requirePermission(deps, 'pass:issue'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const parsed = securityPassSchema.parse(req.body);
        const result = await issueSecurityPass(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          parsed.passNo,
          req.ip ?? null,
        );

        const app = await deps.prisma.application.findUnique({
          where: { id: String(req.params.id) },
          include: { student: true },
        });
        if (app?.student?.email) {
          await notifyPassIssued(
            { prisma: deps.prisma },
            app.id,
            app.student.email,
            app.applicationNo || app.id,
            parsed.passNo,
          );
        }

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 12. Guide: enter monthly attendance
  router.post(
    '/applications/:id/attendance',
    requirePermission(deps, 'attendance:write'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const parsed = attendanceEntrySchema.parse(req.body);
        const result = await enterAttendance(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          parsed,
          req.ip ?? null,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 13. Guide: mark training completed
  router.post(
    '/applications/:id/complete',
    requirePermission(deps, 'clearance:write'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const result = await completeTraining(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          req.ip ?? null,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 14. Admin & HR / Director: issue certificate
  router.post(
    '/applications/:id/certificate',
    requirePermission(deps, 'certificate:issue'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const staffUserId = String(res.locals.userId ?? '');
        const parsed = certificateIssueSchema.parse(req.body ?? {});
        const result = await issueCertificate(
          { prisma: deps.prisma },
          String(req.params.id),
          staffUserId,
          parsed.serialNo,
          req.ip ?? null,
        );

        const app = await deps.prisma.application.findUnique({
          where: { id: String(req.params.id) },
          include: { student: true },
        });
        if (app?.student?.email) {
          await notifyCertificateIssued(
            { prisma: deps.prisma },
            app.id,
            app.student.email,
            app.applicationNo || app.id,
            result.serialNo,
          );
        }

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 15. Seat ledger
  router.get('/seats/ledger', requirePermission(deps, 'seat:read'), async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const ledger = await getSeatLedger({ prisma: deps.prisma });
      res.json(ledger);
    } catch (err) {
      next(err);
    }
  });

  // 16. Audit log
  router.get('/audit', requirePermission(deps, 'audit:read'), async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const logs = await listAuditLogs({ prisma: deps.prisma });
      res.json(logs);
    } catch (err) {
      next(err);
    }
  });

  // 16a. Monthly attendance register and its CSV
  router.get(
    '/attendance/report',
    requirePermission(deps, 'reporting:read'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const month = String(req.query.month ?? '').trim() || new Date().toISOString().slice(0, 7);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
          throw badRequest('INVALID_MONTH', 'Month must be in YYYY-MM form');
        }
        const report = await attendanceReport({ prisma: deps.prisma }, month);
        res.json(report);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/attendance/export.csv',
    requirePermission(deps, 'export:run'),
    async (req, res, next) => {
      try {
        if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
        const month = String(req.query.month ?? '').trim() || new Date().toISOString().slice(0, 7);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
          throw badRequest('INVALID_MONTH', 'Month must be in YYYY-MM form');
        }
        const report = await attendanceReport({ prisma: deps.prisma }, month);

        const csvCell = (value: unknown): string => {
          const text = value === null || value === undefined ? '' : String(value);
          return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        };

        const header = [
          'Application No',
          'Student',
          'Level',
          'Lab',
          'Directorate',
          'Month',
          'Present Days',
          'Total Days',
          'Percent',
        ];
        const lines = report.entries.map((entry) =>
          [
            entry.applicationNo ?? '',
            entry.studentName,
            entry.level,
            entry.labCode,
            entry.directorate ?? '',
            report.month,
            entry.presentDays,
            entry.totalDays,
            entry.percent,
          ]
            .map(csvCell)
            .join(','),
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="ADA-attendance-${report.month}.csv"`);
        res.setHeader('Cache-Control', 'no-store');
        res.send([header.join(','), ...lines].join('\n'));
      } catch (err) {
        next(err);
      }
    },
  );

  // 17. Directorate list
  router.get('/meta/directorates', async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const items = await deps.prisma.directorate.findMany({ where: { isActive: true } });
      res.json({ directorates: items });
    } catch (err) {
      next(err);
    }
  });

  // 18. Guides list
  router.get('/meta/guides', async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const guides = await deps.prisma.user.findMany({
        where: { role: 'GUIDE', isActive: true, deletedAt: null },
        select: { id: true, name: true, email: true, employeeCode: true, directorateId: true },
      });
      res.json({ guides });
    } catch (err) {
      next(err);
    }
  });

  return router;
};

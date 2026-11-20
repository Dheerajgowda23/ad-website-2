import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { ApiError } from '../../lib/http.js';
import { requirePermission } from '../../middleware/auth.js';
import {
  returnForCorrectionSchema,
  rejectEligibilitySchema,
  assignDirectorateCommitteeSchema,
  committeeReviewSchema,
  directorDecisionSchema,
  securityPassSchema,
  attendanceEntrySchema,
  certificateIssueSchema,
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

export const caseworkRouter = (deps: AppDeps): Router => {
  const router = Router();

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

  // 8. Committee score/remarks
  router.post(
    '/applications/:id/review',
    requirePermission(deps, 'committee:score'),
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
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 12. Guide / Admin: enter monthly attendance
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

  // 13. Guide: complete training sign-off
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

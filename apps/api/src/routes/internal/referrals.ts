import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { ApiError } from '../../lib/http.js';
import { requirePermission } from '../../middleware/auth.js';
import { createReferralSchema, revokeReferralSchema } from '@ada/shared';
import {
  createReferralCode,
  listSponsorReferrals,
  revokeReferralCode,
  getReferralAnomalyReport,
} from '../../services/referral.service.js';

export const referralsRouter = (deps: AppDeps): Router => {
  const router = Router();

  // Create new referral code (quota enforced)
  router.post('/', requirePermission(deps, 'referral:create'), async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const userId = String(res.locals.userId ?? '');
      const parsed = createReferralSchema.parse(req.body);
      const result = await createReferralCode(
        { prisma: deps.prisma, env: deps.env },
        {
          userId,
          level: parsed.level,
          studentName: parsed.studentName,
          studentEmail: parsed.studentEmail,
          ip: req.ip ?? null,
        },
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // List sponsor's own referrals
  router.get('/my', requirePermission(deps, 'referral:read:own'), async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const userId = String(res.locals.userId ?? '');
      const result = await listSponsorReferrals({ prisma: deps.prisma }, userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Revoke an unused referral code
  router.post('/:codeId/revoke', requirePermission(deps, 'referral:revoke:own'), async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const userId = String(res.locals.userId ?? '');
      const codeId = String(req.params.codeId ?? '');
      const parsed = revokeReferralSchema.parse(req.body ?? {});
      const result = await revokeReferralCode(
        { prisma: deps.prisma },
        {
          userId,
          codeId,
          reason: parsed.reason,
          ip: req.ip ?? null,
        },
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Anomaly report for Admin & HR
  router.get('/anomalies', requirePermission(deps, 'screening:read'), async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const result = await getReferralAnomalyReport({ prisma: deps.prisma });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
};

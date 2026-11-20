import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { ApiError, badRequest } from '../../lib/http.js';
import { getPublicStatusCheck, verifyCertificatePublic } from '../../services/application.service.js';

export const publicInfoRouter = (deps: AppDeps): Router => {
  const router = Router();

  // Public status check: requires applicationNo and date of birth (DOB)
  router.get('/status-check', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationNo = String(req.query.applicationNo ?? '').trim();
      const dob = String(req.query.dob ?? '').trim();

      if (!applicationNo || !dob) {
        throw badRequest('PARAM_REQUIRED', 'Application number and Date of Birth (YYYY-MM-DD) are required');
      }

      const result = await getPublicStatusCheck({ prisma: deps.prisma }, applicationNo, dob);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Public certificate verification by serial number
  router.get('/certificates/verify/:serialNo', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const serialNo = String(req.params.serialNo ?? '').trim();
      if (!serialNo) {
        throw badRequest('PARAM_REQUIRED', 'Certificate serial number is required');
      }

      const result = await verifyCertificatePublic({ prisma: deps.prisma }, serialNo);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Policy instructions and metadata
  router.get('/guidelines', async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const directorates = await deps.prisma.directorate.findMany({
        where: { isActive: true },
        select: { code: true, name: true, ugCapacity: true, pgCapacity: true },
      });

      res.json({
        policy: {
          reference: 'ADA/ADM/EST/0267/4/S.Trng: 2025',
          date: '31 Dec 2025',
          eligibility: {
            ug: {
              category: 'BE / B.Tech (after 4th or 6th semester)',
              duration: '12 to 20 weeks',
              maxSeats: 50,
            },
            pg: {
              category: 'ME / M.Tech (3rd - 4th semester)',
              duration: '6 to 12 months',
              maxSeats: 25,
            },
          },
          stipend: 'No stipend, no industrial training, no fee.',
          attendance: '100% attendance required for certificate.',
          referralOnly: 'Open applications are disabled. Entry is strictly by referral code from ADA or DRDO employee.',
        },
        directorates,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
};

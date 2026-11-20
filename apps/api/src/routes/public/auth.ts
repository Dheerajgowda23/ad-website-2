import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { otpVerifySchema, redeemSchema, studentOtpRequestSchema } from '@ada/shared';
import type { AppDeps } from '../../types.js';
import { ApiError } from '../../lib/http.js';
import { destroySession, makeRequireStudent } from '../../middleware/auth.js';
import {
  redeemReferralCode,
  requestStudentOtp,
  verifyStudentOtp,
  studentLogoutAudit,
} from '../../services/public-auth.service.js';

const redeemLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  skip: () => process.env.NODE_ENV === 'test' || process.env.PORTAL_ENV === 'test',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' } },
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  skip: () => process.env.NODE_ENV === 'test' || process.env.PORTAL_ENV === 'test',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' } },
});

/**
 * Public sign-in is referral redemption, not registration: without a code from
 * an ADA or DRDO employee there is nothing to sign in to (§1.1).
 */
export const publicAuthRouter = (deps: AppDeps): Router => {
  const router = Router();

  const requirePrisma = () => {
    if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
    return deps.prisma;
  };

  router.post('/redeem', redeemLimiter, async (req, res) => {
    const body = redeemSchema.parse(req.body);
    const result = await redeemReferralCode(
      { prisma: requirePrisma(), env: deps.env },
      { code: body.code, ip: req.ip ?? null },
    );
    res.json(result);
  });

  router.post('/otp/request', otpLimiter, async (req, res) => {
    const body = studentOtpRequestSchema.parse(req.body);
    const challenge = await requestStudentOtp(
      { prisma: requirePrisma(), env: deps.env },
      { referralToken: body.referralToken, email: body.email, ip: req.ip ?? null },
    );
    res.status(202).json(challenge);
  });

  router.post('/otp/verify', otpLimiter, async (req, res) => {
    const body = otpVerifySchema.parse(req.body);
    const result = await verifyStudentOtp(
      { prisma: requirePrisma(), env: deps.env },
      { challengeId: body.challengeId, code: body.code, ip: req.ip ?? null },
    );

    req.session.regenerate((error) => {
      if (error) {
        res.status(500).json({ error: { code: 'SESSION_ERROR', message: 'Could not start a session' } });
        return;
      }
      // Scoped to one application for the public zone.
      req.session.auth = {
        kind: 'student',
        zone: 'public',
        applicationId: result.applicationId,
      };
      res.json({
        applicationId: result.applicationId,
        resumed: result.resumed,
        application: result.view,
        permissions: [],
      });
    });
  });

  router.post('/logout', makeRequireStudent(deps), async (req, res) => {
    const applicationId = String(res.locals.applicationId ?? '');
    if (applicationId && deps.prisma) {
      await studentLogoutAudit({ prisma: deps.prisma }, applicationId, req.ip ?? null);
    }
    await destroySession(req);
    res.status(204).end();
  });

  return router;
};

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { staffEmailRequestSchema, otpVerifySchema, totpVerifySchema } from '@ada/shared';
import type { AppDeps } from '../../types.js';
import { ApiError } from '../../lib/http.js';
import { requestStaffOtp, verifyStaffOtp, verifyStaffTotp, staffLogoutAudit } from '../../services/staff-auth.service.js';
import { regenerateSession, destroySession } from '../../middleware/auth.js';

const emailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  skip: () => process.env.NODE_ENV === 'test' || process.env.PORTAL_ENV === 'test',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many codes requested. Try again later.' } },
});

const verifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  skip: () => process.env.NODE_ENV === 'test' || process.env.PORTAL_ENV === 'test',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } },
});

/**
 * Intranet sign-in. Three steps, one page:
 *   ADA email -> OTP to that mailbox -> TOTP from the enrolled authenticator.
 * There is no password and no role field anywhere in this flow.
 */
export const staffAuthRouter = (deps: AppDeps): Router => {
  const router = Router();

  const requirePrisma = () => {
    if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
    return deps.prisma;
  };

  router.post('/email/request', emailLimiter, async (req, res) => {
    const body = staffEmailRequestSchema.parse(req.body);
    const challenge = await requestStaffOtp(
      { prisma: requirePrisma(), env: deps.env },
      { email: body.email, ip: req.ip ?? null },
    );
    res.status(202).json(challenge);
  });

  router.post('/otp/verify', verifyLimiter, async (req, res) => {
    const body = otpVerifySchema.parse(req.body);
    const pending = await verifyStaffOtp(
      { prisma: requirePrisma(), env: deps.env },
      { challengeId: body.challengeId, code: body.code, ip: req.ip ?? null },
    );
    res.json(pending);
  });

  router.post('/totp/verify', verifyLimiter, async (req, res) => {
    const body = totpVerifySchema.parse(req.body);
    const { user, permissions } = await verifyStaffTotp(
      { prisma: requirePrisma(), env: deps.env },
      { pendingId: body.pendingId, code: body.code, ip: req.ip ?? null },
    );

    // A new session id on privilege change: no fixation, no inherited state.
    await regenerateSession(req);
    req.session.auth = { kind: 'staff', zone: 'internal', userId: user.id, role: user.role };

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employeeCode: user.employeeCode,
        directorateId: user.directorateId,
      },
      permissions,
    });
  });

  router.post('/logout', async (req, res) => {
    const auth = req.session?.auth;
    if (auth?.kind === 'staff' && auth.userId && deps.prisma) {
      await staffLogoutAudit({ prisma: deps.prisma }, { id: auth.userId, role: auth.role ?? 'STUDENT' }, req.ip ?? null);
    }
    await destroySession(req);
    res.status(204).end();
  });

  return router;
};

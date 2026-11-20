import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { makeRequireStaff } from '../../middleware/auth.js';
import { staffAuthRouter } from './auth.js';
import { configRouter } from './config.js';

/**
 * The intranet router tree. Mounted by createApp only when ZONE=internal; in the
 * public zone this module is never attached to the app at all, so every path
 * below is a 404 on the internet host rather than a 403 (§3).
 */
export const staffRouter = (deps: AppDeps): Router => {
  const router = Router();

  router.use('/auth', staffAuthRouter(deps));

  // Everything past this line requires a live intranet session.
  router.use(makeRequireStaff(deps));

  router.get('/me', (_req, res) => {
    const staff = res.locals.staff;
    res.json({ user: staff, role: res.locals.role, permissions: res.locals.permissions ?? [] });
  });

  router.use('/config', configRouter(deps));

  return router;
};

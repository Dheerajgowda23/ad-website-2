import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { publicAuthRouter } from './auth.js';
import { publicApplicationRouter } from './application.js';

/**
 * The internet router tree. Mounted only when ZONE=public. It contains no staff
 * handler, no permission constant that implies staff power and no import from
 * the internal tree.
 */
export const publicRouter = (deps: AppDeps): Router => {
  const router = Router();
  router.use('/auth', publicAuthRouter(deps));
  router.use('/application', publicApplicationRouter(deps));
  return router;
};

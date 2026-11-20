import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { publicAuthRouter } from './auth.js';
import { publicApplicationRouter } from './application.js';
import { publicInfoRouter } from './public-info.js';

export const publicRouter = (deps: AppDeps): Router => {
  const router = Router();

  router.use('/auth', publicAuthRouter(deps));
  router.use('/application', publicApplicationRouter(deps));
  router.use('/info', publicInfoRouter(deps));

  return router;
};

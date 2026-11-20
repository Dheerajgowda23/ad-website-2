import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { ApiError } from '../../lib/http.js';
import { makeRequireStudent } from '../../middleware/auth.js';
import { loadStudentApplication } from '../../services/public-auth.service.js';

/** The student's own application, and nothing else. */
export const publicApplicationRouter = (deps: AppDeps): Router => {
  const router = Router();

  router.get('/', makeRequireStudent(deps), async (_req, res) => {
    if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
    const applicationId = String(res.locals.applicationId ?? '');
    const view = await loadStudentApplication({ prisma: deps.prisma }, applicationId);
    res.json({ application: view });
  });

  return router;
};

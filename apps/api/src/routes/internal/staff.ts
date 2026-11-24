import { Router } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../../types.js';
import { ApiError } from '../../lib/http.js';
import { requirePermission } from '../../middleware/auth.js';
import { ROLE_LABELS } from '@ada/shared';
import {
  createStaff,
  listStaff,
  resetStaffAuthenticator,
  updateStaff,
} from '../../services/staff-admin.service.js';

const staffRoles = Object.keys(ROLE_LABELS).filter((role) => role !== 'STUDENT') as [
  string,
  ...string[],
];

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(staffRoles),
  employeeCode: z.string().trim().max(40).optional().nullable(),
  directorateId: z.string().trim().max(40).optional().nullable(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: z.enum(staffRoles).optional(),
    isActive: z.boolean().optional(),
    employeeCode: z.string().trim().max(40).optional().nullable(),
    directorateId: z.string().trim().max(40).optional().nullable(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });

/** /api/staff/users - Admin & HR only (user:manage). */
export const staffUsersRouter = (deps: AppDeps): Router => {
  const router = Router();

  const requireDb = () => {
    if (!deps.prisma) {
      throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
    }
    return deps.prisma;
  };

  router.get('/', requirePermission(deps, 'user:manage'), async (req, res, next) => {
    try {
      const prisma = requireDb();
      const search = req.query.q ? String(req.query.q) : undefined;
      const users = await listStaff({ prisma }, { search });
      res.json({ users });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requirePermission(deps, 'user:manage'), async (req, res, next) => {
    try {
      const prisma = requireDb();
      const actor = res.locals.staff;
      if (!actor) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
      const body = createSchema.parse(req.body);
      const user = await createStaff({ prisma }, body as any, actor, req.ip ?? null);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', requirePermission(deps, 'user:manage'), async (req, res, next) => {
    try {
      const prisma = requireDb();
      const actor = res.locals.staff;
      if (!actor) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
      const body = updateSchema.parse(req.body);
      const user = await updateStaff({ prisma }, String(req.params.id), body as any, actor, req.ip ?? null);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/reset-authenticator', requirePermission(deps, 'user:manage'), async (req, res, next) => {
    try {
      const prisma = requireDb();
      const actor = res.locals.staff;
      if (!actor) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
      const result = await resetStaffAuthenticator({ prisma }, String(req.params.id), actor, req.ip ?? null);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
};

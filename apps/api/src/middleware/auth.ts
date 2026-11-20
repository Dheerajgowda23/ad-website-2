import type { NextFunction, Request, Response } from 'express';
import { hasPermission, permissionsForRole, ROLE_ZONE, type Permission } from '@ada/shared';
import type { AppDeps, StaffPrincipal } from '../types.js';
import { forbidden, unauthorized } from '../lib/http.js';
import { logZoneEvent } from '../lib/audit.js';

const clientIp = (req: Request): string | null => req.ip ?? null;

export const staffPrincipalFromDb = async (deps: AppDeps, id: string): Promise<StaffPrincipal | null> => {
  if (!deps.prisma) return null;
  const user = await deps.prisma.user.findFirst({
    where: { id, isActive: true, deletedAt: null },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      employeeCode: true,
      directorateId: true,
      isActive: true,
    },
  });
  return user ?? null;
};

/**
 * Rule 6: the role comes from the database row for the session's user id.
 * A role in the session is a cache for routing, never an authority; a role in
 * the request body is ignored entirely.
 */
export const makeRequireStaff = (deps: AppDeps) => {
  const load = deps.loadStaffUser ?? ((id: string) => staffPrincipalFromDb(deps, id));

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // The session may already be gone: zoneClaimGuard destroys a session whose
    // zone claim disagrees with this process before the guard runs.
    const auth = req.session?.auth;
    if (!auth || auth.kind !== 'staff' || !auth.userId) {
      next(unauthorized());
      return;
    }
    if (deps.zone !== 'internal' || auth.zone !== deps.zone) {
      await logZoneEvent(deps.prisma, {
        zone: deps.zone,
        route: req.originalUrl,
        result: 'ZONE_MISMATCH',
        ip: clientIp(req),
      });
      next(unauthorized());
      return;
    }

    const user = await load(auth.userId);
    if (!user || !user.isActive || ROLE_ZONE[user.role] !== deps.zone) {
      req.session?.destroy(() => undefined);
      next(unauthorized());
      return;
    }

    res.locals.staff = user;
    res.locals.userId = user.id;
    res.locals.role = user.role;
    res.locals.permissions = permissionsForRole(user.role);
    next();
  };
};

/** Pair with makeRequireStaff. Denials are recorded for the security trail. */
export const requirePermission = (deps: AppDeps, permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const role = res.locals.role as StaffPrincipal['role'] | undefined;
    if (!role || !hasPermission(role, permission)) {
      await logZoneEvent(deps.prisma, {
        zone: deps.zone,
        route: req.originalUrl,
        result: 'PERMISSION_DENIED',
        ip: clientIp(req),
        meta: { permission, role: role ?? null, method: req.method },
      });
      if (deps.prisma && role) {
        await deps.prisma.auditLog
          .create({
            data: {
              actorId: res.locals.staff?.id ?? null,
              actorRole: role,
              action: 'AUTH_PERMISSION_DENIED',
              entity: 'route',
              entityId: req.originalUrl,
              reason: `missing ${permission}`,
              ip: clientIp(req),
              zone: 'internal',
            },
          })
          .catch(() => undefined);
      }
      next(forbidden('PERMISSION_DENIED', `This action needs the ${permission} permission`));
      return;
    }
    next();
  };
};

/** Public zone: the student session is scoped to exactly one application. */
export const makeRequireStudent = (deps: AppDeps) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = req.session?.auth;
    if (!auth || auth.kind !== 'student' || !auth.applicationId || auth.zone !== 'public') {
      next(unauthorized());
      return;
    }
    if (deps.zone !== 'public') {
      next(unauthorized());
      return;
    }
    res.locals.applicationId = auth.applicationId;
    next();
  };
};

/**
 * Mutations must come from this zone's own origin. Combined with sameSite=lax
 * cookies that closes the ordinary CSRF hole without a token round-trip.
 */
export const sameOriginGuard = (deps: AppDeps) => {
  const allowed = new Set(
    [deps.env.PUBLIC_APP_ORIGIN, deps.env.INTERNAL_APP_ORIGIN].map((origin) => origin.replace(/\/$/, '')),
  );
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      next();
      return;
    }
    const origin = req.get('origin');
    if (origin && !allowed.has(origin.replace(/\/$/, ''))) {
      void logZoneEvent(deps.prisma, {
        zone: deps.zone,
        route: req.originalUrl,
        result: 'FOREIGN_ORIGIN',
        ip: clientIp(req),
        meta: { origin },
      });
      next(forbidden('FOREIGN_ORIGIN', 'Request origin not allowed'));
      return;
    }
    next();
  };
};

/** A session minted in another zone is destroyed, not honoured. */
export const zoneClaimGuard = (deps: AppDeps) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = req.session?.auth;
    if (auth && auth.zone !== deps.zone) {
      req.session.destroy(() => undefined);
      void logZoneEvent(deps.prisma, {
        zone: deps.zone,
        route: req.originalUrl,
        result: 'ZONE_CLAIM_REJECTED',
        ip: clientIp(req),
        meta: { claimedZone: auth.zone },
      });
    }
    next();
  };
};

export const regenerateSession = (req: Request): Promise<void> =>
  new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });

export const destroySession = (req: Request): Promise<void> =>
  new Promise((resolve) => {
    req.session.destroy(() => resolve());
  });

import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { ApiError } from '../../lib/http.js';
import { requirePermission } from '../../middleware/auth.js';
import { memoryFlagStore, prismaFlagStore } from '../../store/flags.js';
import type { AppDeps, FlagStore } from '../../types.js';

const flagBodySchema = z.object({
  zonePublic: z.boolean(),
  zoneInternal: z.boolean(),
  description: z.string().max(280).optional(),
});

const flagView = (flag: {
  key: string;
  zonePublic: boolean;
  zoneInternal: boolean;
  isHardInternal: boolean;
  description: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}) => ({
  key: flag.key,
  zonePublic: flag.zonePublic,
  zoneInternal: flag.zoneInternal,
  isHardInternal: flag.isHardInternal,
  // A hard-internal flag can never be on in the public zone, whatever is stored.
  effectivePublic: flag.zonePublic && !flag.isHardInternal,
  effectiveInternal: flag.zoneInternal,
  description: flag.description,
  updatedBy: flag.updatedBy,
  updatedAt: flag.updatedAt,
});

/**
 * Configuration. ADMIN_HR owns it; DIRECTOR may read. The route exists only in
 * the internal zone - there is no configuration surface on the internet side.
 */
export const configRouter = (deps: AppDeps): Router => {
  const router = Router();
  const store: FlagStore = deps.flagStore ?? (deps.prisma ? prismaFlagStore(deps.prisma) : memoryFlagStore());

  router.get('/', requirePermission(deps, 'config:read'), async (_req, res) => {
    const flags = await store.list();
    res.json({
      flags: flags.map(flagView),
      settings: {
        returnForCorrectionDays: 7,
        editCapPerDay: 10,
        seatsUg: 50,
        seatsPg: 25,
        sponsorQuotaPerYear: 3,
      },
    });
  });

  router.put('/flags/:key', requirePermission(deps, 'config:write'), async (req, res) => {
    const key = String(req.params.key ?? '').slice(0, 64);
    const body = flagBodySchema.parse(req.body);
    const actor = res.locals.staff;
    if (!actor) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');

    const existing = await store.find(key);
    if (existing?.isHardInternal && body.zonePublic) {
      throw new ApiError(409, 'HARD_INTERNAL_FLAG', `${key} can never be enabled on the public zone`);
    }

    const updated = await store.upsert({
      key,
      zonePublic: body.zonePublic,
      zoneInternal: body.zoneInternal,
      isHardInternal: existing?.isHardInternal ?? false,
      description: body.description ?? existing?.description ?? null,
      updatedBy: actor.id,
    });

    if (deps.prisma) {
      await writeAudit(deps.prisma, {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'FEATURE_FLAG_UPDATED',
        entity: 'feature_flags',
        entityId: key,
        before: existing ? flagView(existing) : null,
        after: flagView(updated),
        ip: req.ip ?? null,
        zone: 'internal',
      });
    }

    res.json({ flag: flagView(updated) });
  });

  return router;
};

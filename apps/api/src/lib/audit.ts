import type { PrismaClient, Role, Zone as PrismaZone } from '@prisma/client';
import type { Zone } from '@ada/shared';
import { logger } from './logger.js';

export interface AuditInput {
  actorId?: string | null;
  actorRole: Role;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  zone: Zone;
}

/**
 * Rule 7: every status change and every student edit writes an audit row.
 * Callers must be inside the same transaction as the change they are recording;
 * a best-effort write after the fact is not an audit trail.
 */
export const writeAudit = async (prisma: PrismaClient, input: AuditInput): Promise<void> => {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorRole: input.actorRole,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
      reason: input.reason ?? null,
      ip: input.ip ?? null,
      zone: input.zone as PrismaZone,
    },
  });
};

/**
 * Zone denials are security evidence (§3). Never allowed to fail the request
 * they are describing - but never silent either.
 */
export const logZoneEvent = async (
  prisma: PrismaClient | undefined,
  event: { zone: Zone; route: string; result: string; ip?: string | null; meta?: unknown },
): Promise<void> => {
  if (!prisma) return;
  try {
    await prisma.zoneEvent.create({
      data: {
        zone: event.zone as PrismaZone,
        route: event.route,
        result: event.result,
        ip: event.ip ?? null,
        meta: event.meta === undefined ? undefined : JSON.parse(JSON.stringify(event.meta)),
      },
    });
  } catch (error) {
    logger.warn({ err: error, event }, 'zone event not recorded');
  }
};

import type { PrismaClient } from '@prisma/client';
import type { FlagStore, FlagView } from '../types.js';

/** Feature flags live in Postgres so both zones read one truth (§3). */
export const prismaFlagStore = (prisma: PrismaClient): FlagStore => ({
  list: async () =>
    (await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })) as unknown as FlagView[],
  find: async (key: string) => ((await prisma.featureFlag.findUnique({ where: { key } })) as unknown as FlagView | null) ?? null,
  upsert: async (input) =>
    (await prisma.featureFlag.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        zonePublic: input.zonePublic,
        zoneInternal: input.zoneInternal,
        isHardInternal: input.isHardInternal,
        description: input.description ?? null,
        updatedBy: input.updatedBy,
      },
      update: {
        zonePublic: input.zonePublic,
        zoneInternal: input.zoneInternal,
        description: input.description ?? null,
        updatedBy: input.updatedBy,
      },
    })) as unknown as FlagView,
});

/** Hermetic tests and the M2 skeleton use this; production always uses Postgres. */
export const memoryFlagStore = (initial: FlagView[] = []): FlagStore => {
  const rows = new Map(initial.map((flag) => [flag.key, flag]));
  return {
    list: async () => [...rows.values()].sort((a, b) => a.key.localeCompare(b.key)),
    find: async (key) => rows.get(key) ?? null,
    upsert: async (input) => {
      const existing = rows.get(input.key);
      const row: FlagView = {
        key: input.key,
        zonePublic: input.zonePublic,
        zoneInternal: input.zoneInternal,
        isHardInternal: existing?.isHardInternal ?? input.isHardInternal,
        description: input.description ?? existing?.description ?? null,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      };
      rows.set(input.key, row);
      return row;
    },
  };
};

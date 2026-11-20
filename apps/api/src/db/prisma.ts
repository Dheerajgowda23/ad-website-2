import { PrismaClient } from '@prisma/client';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

/**
 * One client per API process. The process connects with the role of its zone:
 * portal_public on the DMZ, portal_internal inside. Prisma never sees the owner
 * credentials at runtime.
 */
export const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
  log: env.PORTAL_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export type AppPrisma = typeof prisma;

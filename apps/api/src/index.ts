import './config/zone-arg.js';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { pgSessionStore } from './lib/session.js';
import { logger } from './lib/logger.js';
import { prismaFlagStore } from './store/flags.js';

const env = loadEnv();
const sessionStore = pgSessionStore(env.zone, env.DATABASE_URL, env);

const app = createApp({
  env,
  zone: env.zone,
  sessionStore,
  prisma,
  flagStore: prismaFlagStore(prisma),
});

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      zone: env.zone,
      port: env.PORT,
      mounted: env.zone === 'internal' ? ['/api/staff'] : ['/api/public'],
    },
    'ADA portal API listening',
  );
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutting down');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

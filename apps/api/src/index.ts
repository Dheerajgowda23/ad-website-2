import './config/zone-arg.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { pgSessionStore } from './lib/session.js';
import { logger } from './lib/logger.js';
import { prismaFlagStore } from './store/flags.js';
import { processQueuedNotifications } from './services/notification.service.js';
import { checkSecurityEvents } from './services/alert.service.js';
import { sweepNoShows } from './services/casework.service.js';

const env = loadEnv();
const sessionStore = pgSessionStore(env.zone, env.DATABASE_URL, env);

/** The built SPA for this zone: an explicit WEB_DIST wins, else the workspace path. */
const resolveWebDist = (): string | undefined => {
  if (env.WEB_DIST) return resolve(env.WEB_DIST);
  const relative = env.zone === 'public' ? 'apps/web-public/dist' : 'apps/web-internal/dist';
  for (const base of [process.cwd(), resolve(process.cwd(), '../..')]) {
    const candidate = resolve(base, relative);
    if (existsSync(resolve(candidate, 'index.html'))) return candidate;
  }
  return undefined;
};

const webDist = resolveWebDist();

const app = createApp({
  env,
  zone: env.zone,
  sessionStore,
  prisma,
  flagStore: prismaFlagStore(prisma),
  webDist,
});

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      zone: env.zone,
      port: env.PORT,
      mounted: env.zone === 'internal' ? ['/api/staff'] : ['/api/public'],
      web: webDist ?? 'not served (UI is on the Vite dev server)',
    },
    'ADA portal API listening',
  );
});

// Notification rows are written by the casework services; this loop delivers them
// over SMTP. Without a relay the rows stay QUEUED (visible, not silently dropped).
if (env.SMTP_HOST) {
  const dispatch = (): void => {
    void processQueuedNotifications({ prisma, env }).catch((error: unknown) => {
      logger.error({ err: error }, 'notification dispatch failed');
    });
  };
  dispatch();
  setInterval(dispatch, 60_000).unref();
}

// Security alerting: zone mismatches, foreign origins and rejected zone claims are
// already recorded in zone_events; this turns new ones into an email to Admin & HR.
if (env.zone === 'internal') {
  const check = (): void => {
    void checkSecurityEvents({ prisma, env }).catch((error: unknown) => {
      logger.error({ err: error }, 'security event check failed');
    });
  };
  check();
  setInterval(check, 5 * 60_000).unref();

  // Reporting-date sweep: an offer whose reporting date has passed is a NO_SHOW.
  const sweep = (): void => {
    void sweepNoShows({ prisma }).catch((error: unknown) => {
      logger.error({ err: error }, 'no-show sweep failed');
    });
  };
  sweep();
  setInterval(sweep, 60 * 60_000).unref();
}

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutting down');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

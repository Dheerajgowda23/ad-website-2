import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import type { AppDeps } from './types.js';
import { sessionMiddleware } from './lib/session.js';
import { sameOriginGuard, zoneClaimGuard } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './lib/http.js';
import { staffRouter } from './routes/internal/index.js';
import { publicRouter } from './routes/public/index.js';

/**
 * Build the HTTP app for one zone.
 *
 * The zone is a construction argument, not a header, query parameter or cookie:
 * a process either mounts the staff tree or it does not, and there is no code
 * path that yields a staff route on the public zone.
 */
export const createApp = (deps: AppDeps): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((_req, res, next) => {
    res.setHeader('X-ADA-Zone', deps.zone);
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(sessionMiddleware(deps.zone, deps.sessionStore, deps.env));
  app.use(zoneClaimGuard(deps));
  app.use(sameOriginGuard(deps));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, zone: deps.zone });
  });

  if (deps.zone === 'internal') {
    app.use('/api/staff', staffRouter(deps));
  } else {
    app.use('/api/public', publicRouter(deps));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

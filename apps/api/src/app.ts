import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
  // Documents arrive as base64 JSON, so that one route needs a larger body limit
  // than the rest of the API. It is parsed here first; the general parser below
  // then sees the body as already read.
  app.use('/api/public/application/documents', express.json({ limit: '16mb' }));
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

  // One origin per zone: the same process serves its own built SPA. That is what
  // lets an air-gapped install run with two containers and no web server, and it
  // keeps cookies same-origin. Absent in the hermetic tests (no dist on disk).
  const indexHtml = deps.webDist ? join(deps.webDist, 'index.html') : null;
  if (deps.webDist && indexHtml && existsSync(indexHtml)) {
    app.use(
      express.static(deps.webDist, {
        index: false,
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, path) => {
          if (path.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store');
        },
      }),
    );
    // Client-side routes (/login, /application, /verify) fall back to the SPA.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(indexHtml);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

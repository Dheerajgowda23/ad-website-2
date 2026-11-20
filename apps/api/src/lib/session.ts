import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { Role, Zone } from '@ada/shared';
import type { Env } from '../config/env.js';

declare module 'express-session' {
  interface SessionData {
    auth?: {
      kind: 'staff' | 'student';
      zone: Zone;
      userId?: string;
      role?: Role;
      applicationId?: string;
    };
  }
}

/**
 * The cookie name is per zone, and the session record carries the zone it was
 * issued in. Both must agree with the process's ZONE before a request is
 * treated as authenticated - a copied cookie is a dead cookie.
 */
export const SESSION_COOKIE_NAME: Record<Zone, string> = {
  public: 'ada.pub.sid',
  internal: 'ada.int.sid',
};

const SESSION_TABLE: Record<Zone, string> = {
  public: 'session_public',
  internal: 'session_staff',
};

const TTL_MS: Record<Zone, number> = {
  public: 2 * 60 * 60 * 1000, // a student filling one form
  internal: 8 * 60 * 60 * 1000, // a working day
};

export const pgSessionStore = (zone: Zone, databaseUrl: string, env: Env): session.Store => {
  const PgStore = connectPgSimple(session);
  return new PgStore({
    conString: databaseUrl,
    tableName: SESSION_TABLE[zone],
    createTableIfMissing: false,
    pruneSessionInterval: 15 * 60,
    errorLog: (error: Error) => {
      // eslint-disable-next-line no-console
      console.error(`[session:${zone}] ${error.message}`);
    },
    ...(env.PORTAL_ENV === 'development' ? {} : {}),
  });
};

export const sessionMiddleware = (zone: Zone, store: session.Store, env: Env): ReturnType<typeof session> =>
  session({
    name: SESSION_COOKIE_NAME[zone],
    store,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      // Two hosts, one registrable domain in production; lax keeps the
      // cross-host form posts working without opening up CSRF.
      sameSite: 'lax',
      secure: env.PORTAL_ENV === 'production',
      path: '/',
      maxAge: TTL_MS[zone],
    },
  });

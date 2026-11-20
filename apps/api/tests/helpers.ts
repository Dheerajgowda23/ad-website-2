import express from 'express';
import session from 'express-session';
import request from 'supertest';
import type { SessionData } from 'express-session';
import type { Zone } from '@ada/shared';
import { loadEnv, type Env } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { sessionMiddleware } from '../src/lib/session.js';
import { memoryFlagStore } from '../src/store/flags.js';
import type { FlagView, StaffPrincipal } from '../src/types.js';

export const testEnv = (zone: Zone): Env =>
  loadEnv({
    ZONE: zone,
    PORTAL_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:5432/unused',
    SESSION_SECRET: 'test-session-secret-0000000000000000',
    OTP_PEPPER: 'test-otp-pepper-0000000000',
    REFERRAL_HMAC_PEPPER: 'test-referral-pepper-000000',
    TOTP_PEPPER: 'test-totp-pepper-0000000000',
    ALLOW_DEV_OTP: 'false',
    PUBLIC_APP_ORIGIN: 'http://localhost:5173',
    INTERNAL_APP_ORIGIN: 'http://localhost:5174',
    LOG_LEVEL: 'silent',
  } as unknown as NodeJS.ProcessEnv);

export const committeeUser: StaffPrincipal = {
  id: 'u-committee',
  role: 'COMMITTEE',
  name: 'Dr. K. Venkatesh',
  email: 'committee@ada.gov.in',
  employeeCode: 'ADA-2001',
  directorateId: null,
  isActive: true,
};

export const adminUser: StaffPrincipal = {
  id: 'u-admin',
  role: 'ADMIN_HR',
  name: 'Meera Raghavan',
  email: 'admin.hr@ada.gov.in',
  employeeCode: 'ADA-1001',
  directorateId: null,
  isActive: true,
};

export interface HarnessOptions {
  flags?: FlagView[];
}

/**
 * Both zones share one session store and one flag store. That is the harsher
 * arrangement: even if the public process could read an internal session row,
 * the internal route must still not exist there.
 */
export const buildZonePair = (options: HarnessOptions = {}) => {
  const publicEnv = testEnv('public');
  const internalEnv = testEnv('internal');
  const store = new session.MemoryStore();
  const flags = memoryFlagStore(options.flags ?? []);
  const users: Record<string, StaffPrincipal> = {
    [committeeUser.id]: committeeUser,
    [adminUser.id]: adminUser,
  };
  const loadStaffUser = async (id: string): Promise<StaffPrincipal | null> => users[id] ?? null;

  const publicApp = createApp({ env: publicEnv, zone: 'public', sessionStore: store, flagStore: flags, loadStaffUser });
  const internalApp = createApp({ env: internalEnv, zone: 'internal', sessionStore: store, flagStore: flags, loadStaffUser });

  /** Mint a genuine cookie through the same session middleware the app uses. */
  const mintCookie = async (zone: Zone, auth: NonNullable<SessionData['auth']>): Promise<string> => {
    const minter = express();
    minter.use(sessionMiddleware(zone, store, zone === 'public' ? publicEnv : internalEnv));
    minter.get('/mint', (req, res) => {
      req.session.auth = auth;
      res.json({ ok: true });
    });
    const response = await request(minter).get('/mint');
    const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
    if (!cookies?.[0]) throw new Error('session cookie was not minted');
    return cookies[0].split(';')[0]!;
  };

  return { publicApp, internalApp, store, mintCookie, flags };
};

export const hardInternalFlags = (): FlagView[] => [
  {
    key: 'staff_config_ui',
    zonePublic: false,
    zoneInternal: true,
    isHardInternal: true,
    description: 'Configuration screen (intranet only)',
    updatedBy: null,
    updatedAt: new Date(),
  },
  {
    key: 'public_status_check',
    zonePublic: true,
    zoneInternal: true,
    isHardInternal: false,
    description: 'Application status check',
    updatedBy: null,
    updatedAt: new Date(),
  },
];

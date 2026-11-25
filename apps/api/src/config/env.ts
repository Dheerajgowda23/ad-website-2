import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { zoneFromEnv, type Zone } from '@ada/shared';

/**
 * Environment. Parsed once at boot; a missing or malformed value stops the
 * process rather than producing a half-configured zone.
 */
const loadDotEnv = (): void => {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
};

loadDotEnv();

const booleanish = z
  .string()
  .optional()
  .transform((value) => value === 'true' || value === '1');

const baseSchema = z.object({
  ZONE: z.enum(['public', 'internal']),
  PORTAL_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(24, 'SESSION_SECRET must be at least 24 characters'),
  OTP_PEPPER: z.string().min(16, 'OTP_PEPPER must be at least 16 characters'),
  REFERRAL_HMAC_PEPPER: z.string().min(16, 'REFERRAL_HMAC_PEPPER must be at least 16 characters'),
  TOTP_PEPPER: z.string().min(16).default('dev-only-totp-pepper-change-me'),
  ALLOW_DEV_OTP: booleanish.default('true'),
  PUBLIC_APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  INTERNAL_APP_ORIGIN: z.string().url().default('http://localhost:5174'),
  LOG_LEVEL: z.string().default('info'),
  // Production sets Secure cookies by default. An intranet deployment served over
  // plain HTTP (no TLS yet) must set COOKIE_SECURE=false, or sign-in silently fails.
  COOKIE_SECURE: booleanish.optional(),
  // Where the built SPA for this zone lives. Both zones can serve their own UI,
  // which is what makes an offline, single-origin intranet install possible.
  WEB_DIST: z.string().optional(),
  // Document storage. A mounted volume in the container; no object store to run.
  FILE_STORAGE_DIR: z.string().default('./data/files'),
  // Key for AES-256-GCM at rest. Falls back to SESSION_SECRET for dev installs;
  // set it explicitly in production, and keep it with the backups.
  FILE_ENCRYPTION_KEY: z.string().min(16).optional(),
  // SMTP relay. Without it, OTP delivery only works with ALLOW_DEV_OTP=true.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanish.default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('ADA Internship Portal <no-reply@ada.gov.in>'),
  // Committee reviews required before a packet leaves COMMITTEE_REVIEW. Capped
  // by the number of members actually assigned to the batch.
  COMMITTEE_QUORUM: z.coerce.number().int().min(1).max(9).default(2),
});

export type Env = z.infer<typeof baseSchema> & { zone: Zone; SECURE_COOKIES: boolean };

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const zone = zoneFromEnv(source.ZONE);
  if (!zone) throw new Error(`ZONE must be "public" or "internal" (got ${String(source.ZONE)})`);

  // Each zone connects as its own Postgres role. DATABASE_URL wins when set
  // explicitly (containers, migrations); otherwise the zone picks its own role.
  const resolved = { ...source };
  if (!resolved.DATABASE_URL) {
    resolved.DATABASE_URL = zone === 'public' ? resolved.DATABASE_URL_PUBLIC : resolved.DATABASE_URL_INTERNAL;
  }

  // An inherited PORT=0 (or nothing at all) must not put both zones on the same
  // port: each zone has its own listen port.
  if (!(Number(resolved.PORT) > 0)) {
    resolved.PORT = zone === 'public' ? (resolved.PUBLIC_API_PORT ?? '4000') : (resolved.INTERNAL_API_PORT ?? '4001');
  }

  const parsed = baseSchema.safeParse(resolved);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment: ${detail}`);
  }
  const env = parsed.data;
  return {
    ...env,
    zone: env.ZONE,
    // Returning live OTP/TOTP codes in an HTTP response is a development aid only.
    ALLOW_DEV_OTP: env.ALLOW_DEV_OTP && env.PORTAL_ENV !== 'production',
    SECURE_COOKIES: env.COOKIE_SECURE ?? env.PORTAL_ENV === 'production',
  };
};

/** The browser origin allowed to POST with credentials in this zone. */
export const appOriginFor = (env: Env): string =>
  env.zone === 'public' ? env.PUBLIC_APP_ORIGIN : env.INTERNAL_APP_ORIGIN;

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Zone } from '@ada/shared';

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
});

export type Env = z.infer<typeof baseSchema> & { zone: Zone };

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = baseSchema.safeParse(source);
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
  };
};

/** The browser origin allowed to POST with credentials in this zone. */
export const appOriginFor = (env: Env): string =>
  env.zone === 'public' ? env.PUBLIC_APP_ORIGIN : env.INTERNAL_APP_ORIGIN;

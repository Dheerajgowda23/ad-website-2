import pino from 'pino';

/**
 * JSON logs with a zone field on every line (§9). The zone is read from the
 * process environment at import time, so a line can never claim the wrong side.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    zone: process.env.ZONE ?? 'unset',
    service: 'ada-portal-api',
  },
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', '*.code', '*.totpSecret', '*.otp'],
    remove: true,
  },
});

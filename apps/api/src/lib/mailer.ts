import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Outbound email.
 *
 * An air-gapped intranet still has an internal SMTP relay, so the portal sends
 * through SMTP_HOST rather than a hosted API. When no relay is configured the
 * send is reported as undelivered instead of being faked: in development the OTP
 * is echoed in the API response, and in production a missing relay is a boot-time
 * configuration error the installer must fix.
 */
let cached: Transporter | null = null;
let cachedKey = '';

export const isMailConfigured = (env: Env): boolean => Boolean(env.SMTP_HOST);

const transporterFor = (env: Env): Transporter => {
  const key = [env.SMTP_HOST, env.SMTP_PORT, env.SMTP_USER ?? '', env.SMTP_SECURE].join('|');
  if (cached && cachedKey === key) return cached;

  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' } }
      : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cachedKey = key;
  return cached;
};

export interface MailResult {
  delivered: boolean;
  providerId?: string;
  error?: string;
}

export const sendMail = async (
  env: Env,
  input: { to: string; subject: string; text: string },
): Promise<MailResult> => {
  if (!isMailConfigured(env)) {
    logger.warn({ to: input.to, subject: input.subject }, 'SMTP not configured; email deferred');
    return { delivered: false, error: 'SMTP_NOT_CONFIGURED' };
  }

  try {
    const info = await transporterFor(env).sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    logger.info({ to: input.to, messageId: info.messageId }, 'email sent');
    return { delivered: true, providerId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ to: input.to, err: message }, 'email delivery failed');
    return { delivered: false, error: message };
  }
};

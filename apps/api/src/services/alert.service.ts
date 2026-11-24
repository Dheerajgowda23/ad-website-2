import type { PrismaClient } from '@prisma/client';
import type { Env } from '../config/env.js';
import { sendMail } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';

/**
 * Security alerting (handoff §10, M7).
 *
 * zone_events already records zone mismatches, foreign origins and rejected zone
 * claims. Recording is not alerting: nothing read them. This watcher mails Admin &
 * HR when new security events appear, so a copied internal cookie on the public
 * host produces an email rather than a row nobody opens.
 *
 * Duplicate suppression is in-memory: the process remembers the last id it
 * reported. That is enough for one container per zone, which is how the portal is
 * deployed; a multi-replica deployment would move the cursor into the database.
 */
const REPORTED_RESULTS = ['ZONE_MISMATCH', 'FOREIGN_ORIGIN', 'ZONE_CLAIM_REJECTED'] as const;

let lastReportedAt: Date | null = null;

export interface AlertResult {
  checked: number;
  alerted: boolean;
  recipients: number;
}

export const checkSecurityEvents = async (
  deps: { prisma: PrismaClient; env: Env },
  options: { lookbackMinutes?: number } = {},
): Promise<AlertResult> => {
  const lookback = options.lookbackMinutes ?? 15;
  const since = lastReportedAt ?? new Date(Date.now() - lookback * 60 * 1000);

  const events = await deps.prisma.zoneEvent.findMany({
    where: {
      at: { gt: since },
      result: { in: REPORTED_RESULTS as unknown as never[] },
    },
    orderBy: { at: 'asc' },
    take: 200,
  });

  lastReportedAt = new Date();

  if (events.length === 0) return { checked: 0, alerted: false, recipients: 0 };

  if (!deps.env.SMTP_HOST) {
    logger.warn({ count: events.length }, 'security events found but SMTP is not configured');
    return { checked: events.length, alerted: false, recipients: 0 };
  }

  const admins = await deps.prisma.user.findMany({
    where: { role: 'ADMIN_HR', isActive: true, deletedAt: null },
    select: { email: true },
  });

  const lines = events.map(
    (event) =>
      `${event.at.toISOString()}  ${event.result}  zone=${event.zone}  route=${event.route}  ip=${event.ip ?? '-'}`,
  );

  let recipients = 0;
  for (const admin of admins) {
    const result = await sendMail(deps.env, {
      to: admin.email,
      subject: `ADA portal security alert: ${events.length} event(s)`,
      text: [
        'The portal recorded security events that need review:',
        '',
        ...lines,
        '',
        'Open the audit trail in the staff portal for context. If this was a copied session',
        'cookie or a request from another origin, treat it as an incident.',
      ].join('\n'),
    });
    if (result.delivered) recipients += 1;
  }

  logger.warn({ count: events.length, recipients }, 'security events reported to Admin & HR');
  return { checked: events.length, alerted: recipients > 0, recipients };
};

/** Test hook: forget the cursor so the next check reads from the lookback window. */
export const resetSecurityAlertCursor = (): void => {
  lastReportedAt = null;
};

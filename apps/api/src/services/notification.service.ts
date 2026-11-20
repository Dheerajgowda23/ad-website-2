import type { PrismaClient } from '@prisma/client';
import { pino } from 'pino';

const logger = pino({ name: 'notifications' });

export interface QueueNotificationInput {
  applicationId?: string | null;
  to: string;
  template: string;
  channel?: 'EMAIL' | 'SMS';
}

/**
 * Persists a queued notification to the notifications table.
 */
export async function queueNotification(
  deps: { prisma: PrismaClient },
  input: QueueNotificationInput,
) {
  const record = await deps.prisma.notification.create({
    data: {
      applicationId: input.applicationId ?? null,
      to: input.to,
      template: input.template,
      channel: input.channel ?? 'EMAIL',
      status: 'QUEUED',
    },
  });

  logger.info(
    { notificationId: record.id, to: input.to, template: input.template },
    'Notification queued',
  );

  return record;
}

/**
 * Processes queued notifications.
 * In development and test environments, this dispatches via mock provider immediately.
 */
export async function processQueuedNotifications(
  deps: { prisma: PrismaClient },
) {
  const pending = await deps.prisma.notification.findMany({
    where: { status: 'QUEUED' },
    take: 50,
  });

  const processed = [];
  const now = new Date();

  for (const item of pending) {
    logger.info(
      { notificationId: item.id, to: item.to, template: item.template },
      'Dispatching notification (dev/test mock provider)',
    );

    const updated = await deps.prisma.notification.update({
      where: { id: item.id },
      data: {
        status: 'SENT',
        sentAt: now,
        providerId: `mock-email-${item.id}`,
      },
    });
    processed.push(updated);
  }

  return processed;
}

// Convenience dispatchers for application lifecycle events

export async function notifyReferralIssued(
  deps: { prisma: PrismaClient },
  sponsorEmail: string,
  code: string,
  level: string,
) {
  return queueNotification(deps, {
    to: sponsorEmail,
    template: `REFERRAL_ISSUED: Code ${code} generated for ${level} programme. Share with the eligible candidate.`,
  });
}

export async function notifyApplicationSubmitted(
  deps: { prisma: PrismaClient },
  applicationId: string,
  studentEmail: string,
  sponsorEmail: string | null,
  applicationNo: string,
  studentName: string,
) {
  await queueNotification(deps, {
    applicationId,
    to: studentEmail,
    template: `APPLICATION_SUBMITTED: Dear ${studentName}, your application ${applicationNo} has been submitted for Admin & HR verification.`,
  });

  if (sponsorEmail) {
    await queueNotification(deps, {
      applicationId,
      to: sponsorEmail,
      template: `REFERRAL_SUBMITTED: Candidate ${studentName} has submitted application ${applicationNo} using your referral.`,
    });
  }
}

export async function notifyCorrectionRequested(
  deps: { prisma: PrismaClient },
  applicationId: string,
  studentEmail: string,
  applicationNo: string,
  reason: string,
) {
  return queueNotification(deps, {
    applicationId,
    to: studentEmail,
    template: `RETURNED_FOR_CORRECTION: Application ${applicationNo} requires corrections: ${reason}. Please update and resubmit within 7 days.`,
  });
}

export async function notifyOfferIssued(
  deps: { prisma: PrismaClient },
  applicationId: string,
  studentEmail: string,
  applicationNo: string,
  reportingDate: string,
) {
  return queueNotification(deps, {
    applicationId,
    to: studentEmail,
    template: `OFFER_ISSUED: Congratulations! Provisional Offer of Training issued for ${applicationNo}. Reporting date: ${reportingDate}. Login to accept.`,
  });
}

export async function notifyOfferAccepted(
  deps: { prisma: PrismaClient },
  applicationId: string,
  studentEmail: string,
  applicationNo: string,
) {
  return queueNotification(deps, {
    applicationId,
    to: studentEmail,
    template: `OFFER_ACCEPTED: You have formally accepted offer for ${applicationNo}. Please report to Security Desk on scheduled date with original documents.`,
  });
}

export async function notifyPassIssued(
  deps: { prisma: PrismaClient },
  applicationId: string,
  studentEmail: string,
  applicationNo: string,
  passNo: string,
) {
  return queueNotification(deps, {
    applicationId,
    to: studentEmail,
    template: `SECURITY_PASS_ISSUED: Security pass ${passNo} has been issued for application ${applicationNo}. Training is now active.`,
  });
}

export async function notifyCertificateIssued(
  deps: { prisma: PrismaClient },
  applicationId: string,
  studentEmail: string,
  applicationNo: string,
  serialNo: string,
) {
  return queueNotification(deps, {
    applicationId,
    to: studentEmail,
    template: `CERTIFICATE_ISSUED: Official Certificate ${serialNo} has been issued for your training at ADA. You can download or verify it online.`,
  });
}

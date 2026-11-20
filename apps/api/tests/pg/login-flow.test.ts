import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { formatReferralCode } from '@ada/shared';
import { loadEnv, type Env } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';
import { pgSessionStore } from '../../src/lib/session.js';
import { memoryFlagStore } from '../../src/store/flags.js';
import { hmacHex, generateTotpSecret, generateReferralBody, sha256Hex } from '../../src/lib/crypto.js';
import { totpAt } from '../../src/lib/totp.js';

/**
 * The login flows against a real PostgreSQL, through the real Express app, as
 * the real runtime role (portal_public / portal_internal).
 *
 * Why it exists: a missing table grant is invisible to the hermetic tests, which
 * never touch a database. On the running portal it appeared as
 * "permission denied for table sponsors" wrapped in a 500. Here the same mistake
 * fails an assertion instead.
 *
 * Requires `docker compose up -d db` and an applied migration.
 */

const ownerUrl = process.env.MIGRATION_DATABASE_URL;
const publicUrl = process.env.DATABASE_URL_PUBLIC;
const internalUrl = process.env.DATABASE_URL_INTERNAL;

if (!ownerUrl || !publicUrl || !internalUrl) {
  throw new Error(
    'These tests need a database: copy .env.example to .env, run `docker compose up -d db` and `npm run db:migrate`.',
  );
}

const publicEnv: Env = loadEnv({
  ...process.env,
  ZONE: 'public',
  PORTAL_ENV: 'test',
  ALLOW_DEV_OTP: 'true',
} as NodeJS.ProcessEnv);

const internalEnv: Env = loadEnv({
  ...process.env,
  ZONE: 'internal',
  PORTAL_ENV: 'test',
  ALLOW_DEV_OTP: 'true',
} as NodeJS.ProcessEnv);

const suffix = randomUUID().slice(0, 8);
const studentEmail = `student-${suffix}@example.edu.in`;
const staffEmail = `staff-${suffix}@ada.gov.in`;

const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
const publicDb = new PrismaClient({ datasources: { db: { url: publicUrl } } });
const internalDb = new PrismaClient({ datasources: { db: { url: internalUrl } } });

const publicStore = pgSessionStore('public', publicUrl, publicEnv);
const internalStore = pgSessionStore('internal', internalUrl, internalEnv);

const publicApp = createApp({
  env: publicEnv,
  zone: 'public',
  sessionStore: publicStore,
  prisma: publicDb,
  flagStore: memoryFlagStore(),
});

const internalApp = createApp({
  env: internalEnv,
  zone: 'internal',
  sessionStore: internalStore,
  prisma: internalDb,
  flagStore: memoryFlagStore(),
});

interface Fixtures {
  labId: string;
  sponsorId: string;
  sponsorEmail: string;
  validCode: string;
  validCodeId: string;
  expiredCode: string;
  staffId: string;
  staffTotpSecret: string;
  createdApplicationIds: string[];
}

let fx: Fixtures;

beforeAll(async () => {
  try {
    await owner.$queryRaw`SELECT 1`;
  } catch (error) {
    throw new Error(
      `Postgres is not reachable (${(error as Error).message}). Start it with \`docker compose up -d db\` and apply migrations.`,
    );
  }

  const lab = await owner.lab.create({
    data: { code: `T${suffix.slice(0, 6).toUpperCase()}`, name: 'Test Referral Lab', type: 'DRDO_OTHER' },
  });

  const sponsorEmail = `sponsor-${suffix}@ada.gov.in`;
  const sponsor = await owner.sponsor.create({
    data: {
      labId: lab.id,
      fullName: 'Vikram Test Sponsor',
      officialEmail: sponsorEmail,
      quotaYear: 2099,
      verificationStatus: 'VERIFIED',
    },
  });

  const validCode = formatReferralCode('TST-26', generateReferralBody());
  const valid = await owner.referralCode.create({
    data: {
      codeHmac: hmacHex(validCode, publicEnv.REFERRAL_HMAC_PEPPER),
      codePrefix: 'TST-26',
      sponsorId: sponsor.id,
      labId: lab.id,
      level: 'PG',
      intakeYear: 2099,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const expiredCode = formatReferralCode('TST-26', generateReferralBody());
  await owner.referralCode.create({
    data: {
      codeHmac: hmacHex(expiredCode, publicEnv.REFERRAL_HMAC_PEPPER),
      codePrefix: 'TST-26',
      sponsorId: sponsor.id,
      labId: lab.id,
      level: 'UG',
      intakeYear: 2099,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });

  const staffTotpSecret = generateTotpSecret();
  const staff = await owner.user.create({
    data: {
      role: 'COMMITTEE',
      name: 'Test Committee Member',
      email: staffEmail,
      employeeCode: `T-${suffix}`,
      totpSecret: staffTotpSecret,
      totpEnrolledAt: new Date(),
    },
  });

  fx = {
    labId: lab.id,
    sponsorId: sponsor.id,
    sponsorEmail,
    validCode,
    validCodeId: valid.id,
    expiredCode,
    staffId: staff.id,
    staffTotpSecret,
    createdApplicationIds: [],
  };
});

afterAll(async () => {
  if (fx) {
    await owner.notification.deleteMany({ where: { applicationId: { in: fx.createdApplicationIds } } });
    await owner.auditLog.deleteMany({
      where: { entityId: { in: [...fx.createdApplicationIds, fx.validCodeId, fx.staffId] } },
    });
    await owner.applicationRevision.deleteMany({ where: { applicationId: { in: fx.createdApplicationIds } } });
    await owner.document.deleteMany({ where: { applicationId: { in: fx.createdApplicationIds } } });
    await owner.application.deleteMany({ where: { id: { in: fx.createdApplicationIds } } });
    await owner.student.deleteMany({ where: { email: studentEmail } });
    await owner.referralCode.deleteMany({ where: { sponsorId: fx.sponsorId } });
    await owner.sponsor.deleteMany({ where: { id: fx.sponsorId } });
    await owner.lab.deleteMany({ where: { id: fx.labId } });
    await owner.user.deleteMany({ where: { id: fx.staffId } });
    await owner.otpChallenge.deleteMany({ where: { subjectHash: sha256Hex(studentEmail) } });
    await owner.otpChallenge.deleteMany({ where: { subjectHash: sha256Hex(staffEmail) } });
  }
  for (const store of [publicStore, internalStore]) {
    const closable = store as unknown as { close?: (callback?: () => void) => void };
    closable.close?.(() => undefined);
  }
  await Promise.all([owner.$disconnect(), publicDb.$disconnect(), internalDb.$disconnect()]);
});

describe('public zone: referral redemption and email OTP against Postgres', () => {
  const agent = request.agent(publicApp);
  let referralToken = '';

  it('redeems a valid code and names the sponsor', async () => {
    const response = await agent.post('/api/public/auth/redeem').send({ code: fx.validCode });

    expect(response.status).toBe(200);
    expect(response.body.referral.sponsorName).toBe('Vikram Test Sponsor');
    // Level comes from the stored code, not from anything the client sent.
    expect(response.body.referral.level).toBe('PG');
    expect(response.body.referralToken).toBeTruthy();

    referralToken = response.body.referralToken as string;
  });

  it('answers an expired code exactly like an unknown one', async () => {
    // The spec is one generic failure: never reveal which of invalid, expired,
    // revoked or used applies. Comparing the two responses is the assertion.
    const expired = await request(publicApp)
      .post('/api/public/auth/redeem')
      .send({ code: fx.expiredCode });

    const unknown = await request(publicApp)
      .post('/api/public/auth/redeem')
      .send({ code: formatReferralCode('TST-26', generateReferralBody()) });

    expect(expired.status).toBe(401);
    expect(expired.body).toEqual(unknown.body);
    expect(expired.body.error.code).toBe('INVALID_CODE');
  });

  it('completes OTP login, creates the application, and writes the audit trail', async () => {
    const otpResponse = await agent
      .post('/api/public/auth/otp/request')
      .send({ referralToken, email: studentEmail });

    expect(otpResponse.status).toBe(202);
    expect(otpResponse.body.devCode).toMatch(/^\d{6}$/);

    const verify = await agent
      .post('/api/public/auth/otp/verify')
      .send({ challengeId: otpResponse.body.challengeId, code: otpResponse.body.devCode });

    expect(verify.status).toBe(200);
    expect(verify.body.application.status).toBe('IN_PROGRESS');
    expect(verify.body.application.applicationNo).toBeNull();

    const applicationId = (
      await owner.application.findFirstOrThrow({
        where: { student: { email: studentEmail } },
        select: { id: true },
      })
    ).id;
    fx.createdApplicationIds.push(applicationId);

    // The session is a real row in session_public, scoped to this application.
    const session = await agent.get('/api/public/application');
    expect(session.status).toBe(200);
    expect(session.body.application.level).toBe('PG');
    // Only the last four digits are ever stored; with none on file, the mask is
    // still applied rather than an empty field leaking through.
    expect(session.body.application.student.aadhaarMasked).toBe('—');

    // Domain effects, read back with the owner connection.
    const code = await owner.referralCode.findUniqueOrThrow({ where: { id: fx.validCodeId } });
    expect(code.boundStudentEmail).toBe(studentEmail);
    expect(code.usedByApplicationId).toBe(applicationId);

    const application = await owner.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(application.entryChannel).toBe('REFERRED');
    expect(application.sponsorId).toBe(fx.sponsorId);
    expect(application.labId).toBe(fx.labId);

    const audit = await owner.auditLog.findMany({ where: { entityId: { in: [applicationId, fx.validCodeId] } } });
    expect(audit.map((row) => row.action).sort()).toEqual(['APPLICATION_CREATED', 'REFERRAL_REDEEMED']);

    const notification = await owner.notification.findFirst({
      where: { applicationId, template: 'REFERRAL_REDEEMED' },
    });
    expect(notification?.to).toBe(fx.sponsorEmail);
    expect(notification?.status).toBe('QUEUED');
  });

  it('refuses a code that has already been used', async () => {
    const response = await request(publicApp)
      .post('/api/public/auth/redeem')
      .send({ code: fx.validCode });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CODE');
  });

  it('cannot read staff tables with the public role', async () => {
    // The privilege boundary itself: not a route, the database role.
    await expect(publicDb.user.findMany()).rejects.toThrow(/permission denied|does not exist/i);
  });
});

describe('intranet zone: email OTP then TOTP against Postgres', () => {
  it('signs a staff member in and records the login', async () => {
    const agent = request.agent(internalApp);

    const otpResponse = await agent.post('/api/staff/auth/email/request').send({ email: staffEmail });
    expect(otpResponse.status).toBe(202);

    const otpVerify = await agent
      .post('/api/staff/auth/otp/verify')
      .send({ challengeId: otpResponse.body.challengeId, code: otpResponse.body.devCode });

    expect(otpVerify.status).toBe(200);
    expect(otpVerify.body.stage).toBe('TOTP_REQUIRED');

    const totpVerify = await agent
      .post('/api/staff/auth/totp/verify')
      .send({ pendingId: otpVerify.body.pendingId, code: totpAt(fx.staffTotpSecret) });

    expect(totpVerify.status).toBe(200);
    expect(totpVerify.body.user.role).toBe('COMMITTEE');

    const me = await agent.get('/api/staff/me');
    expect(me.status).toBe(200);
    expect(me.body.permissions).toEqual(['committee:read', 'committee:score']);

    const audit = await owner.auditLog.findMany({
      where: { entityId: fx.staffId, action: 'AUTH_LOGIN_SUCCEEDED' },
    });
    expect(audit.length).toBeGreaterThan(0);

    // The same cookie, presented to the public process, is a dead route.
    const cookies = me.headers['set-cookie'] as unknown as string[];
    const cookieHeader = cookies.map((cookie) => cookie.split(';')[0]).join('; ');
    const onPublic = await request(publicApp).get('/api/staff/me').set('Cookie', cookieHeader);
    expect(onPublic.status).toBe(404);
  });

  it('refuses a wrong TOTP code', async () => {
    const agent = request.agent(internalApp);
    const otpResponse = await agent.post('/api/staff/auth/email/request').send({ email: staffEmail });
    const otpVerify = await agent
      .post('/api/staff/auth/otp/verify')
      .send({ challengeId: otpResponse.body.challengeId, code: otpResponse.body.devCode });

    const wrong = totpAt(fx.staffTotpSecret) === '000000' ? '111111' : '000000';
    const totpVerify = await agent
      .post('/api/staff/auth/totp/verify')
      .send({ pendingId: otpVerify.body.pendingId, code: wrong });

    expect(totpVerify.status).toBe(401);
    expect(totpVerify.body.error.code).toBe('TOTP_INVALID');
  });
});

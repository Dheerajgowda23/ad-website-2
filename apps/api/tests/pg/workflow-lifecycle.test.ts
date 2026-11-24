import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { loadEnv, type Env } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';
import { pgSessionStore } from '../../src/lib/session.js';
import { memoryFlagStore } from '../../src/store/flags.js';
import { generateTotpSecret } from '../../src/lib/crypto.js';
import { totpAt } from '../../src/lib/totp.js';

const ownerUrl = process.env.MIGRATION_DATABASE_URL;
const publicUrl = process.env.DATABASE_URL_PUBLIC;
const internalUrl = process.env.DATABASE_URL_INTERNAL;

if (!ownerUrl || !publicUrl || !internalUrl) {
  throw new Error('Database URLs are required for workflow tests');
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
const studentEmail = `student-${suffix}@college.edu.in`;
const testAadhaar = String(Math.floor(1000 + Math.random() * 9000));

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

let labId: string;
let directorateId: string;
let sponsorUser: any;
let adminHrUser: any;
let committeeUser: any;
let directorUser: any;
let securityUser: any;
let guideUser: any;

let sponsorAgent: ReturnType<typeof request.agent>;
let adminHrAgent: ReturnType<typeof request.agent>;
let committeeAgent: ReturnType<typeof request.agent>;
let directorAgent: ReturnType<typeof request.agent>;
let securityAgent: ReturnType<typeof request.agent>;
let guideAgent: ReturnType<typeof request.agent>;
let studentAgent: ReturnType<typeof request.agent>;

let issuedReferralCode: string;
let createdApplicationId: string;
let issuedSerialNo: string;

const loginStaffAgent = async (email: string, secret: string) => {
  const agent = request.agent(internalApp);
  const otpRes = await agent
    .post('/api/staff/auth/email/request')
    .send({ email })
    .expect(202);

  const challengeId = otpRes.body.challengeId;
  const devCode = otpRes.body.devCode;

  const verifyOtpRes = await agent
    .post('/api/staff/auth/otp/verify')
    .send({ challengeId, code: devCode })
    .expect(200);

  const pendingId = verifyOtpRes.body.pendingId;
  const currentTotp = totpAt(secret);

  await agent
    .post('/api/staff/auth/totp/verify')
    .send({ pendingId, code: currentTotp })
    .expect(200);

  return agent;
};

beforeAll(async () => {
  const randomLetters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const lab = await owner.lab.create({
    data: { code: `TL${randomLetters}`, name: 'Test Lab', type: 'DRDO_OTHER' },
  });
  labId = lab.id;

  const directorate = await owner.directorate.create({
    data: {
      code: `D${suffix.slice(0, 5).toUpperCase()}`,
      name: 'Test Directorate',
      ugCapacity: 10,
      pgCapacity: 5,
    },
  });
  directorateId = directorate.id;

  const sponsorSecret = generateTotpSecret();
  sponsorUser = await owner.user.create({
    data: {
      email: `sponsor-${suffix}@ada.gov.in`,
      name: 'Test Sponsor',
      role: 'SPONSOR',
      totpSecret: sponsorSecret,
      totpEnrolledAt: new Date(),
    },
  });
  await owner.sponsor.create({
    data: {
      userId: sponsorUser.id,
      labId,
      fullName: 'Test Sponsor',
      officialEmail: sponsorUser.email,
      quotaYear: 2026,
      quotaUsed: 0,
      verificationStatus: 'VERIFIED',
    },
  });

  const adminSecret = generateTotpSecret();
  adminHrUser = await owner.user.create({
    data: {
      email: `admin-${suffix}@ada.gov.in`,
      name: 'Test Admin HR',
      role: 'ADMIN_HR',
      totpSecret: adminSecret,
      totpEnrolledAt: new Date(),
    },
  });

  const committeeSecret = generateTotpSecret();
  committeeUser = await owner.user.create({
    data: {
      email: `committee-${suffix}@ada.gov.in`,
      name: 'Test Committee',
      role: 'COMMITTEE',
      totpSecret: committeeSecret,
      totpEnrolledAt: new Date(),
    },
  });

  const directorSecret = generateTotpSecret();
  directorUser = await owner.user.create({
    data: {
      email: `director-${suffix}@ada.gov.in`,
      name: 'Test Director',
      role: 'DIRECTOR',
      totpSecret: directorSecret,
      totpEnrolledAt: new Date(),
    },
  });

  const securitySecret = generateTotpSecret();
  securityUser = await owner.user.create({
    data: {
      email: `security-${suffix}@ada.gov.in`,
      name: 'Test Security',
      role: 'SECURITY',
      totpSecret: securitySecret,
      totpEnrolledAt: new Date(),
    },
  });

  const guideSecret = generateTotpSecret();
  guideUser = await owner.user.create({
    data: {
      email: `guide-${suffix}@ada.gov.in`,
      name: 'Test Guide',
      role: 'GUIDE',
      totpSecret: guideSecret,
      totpEnrolledAt: new Date(),
    },
  });

  // Log in each staff role agent
  sponsorAgent = await loginStaffAgent(sponsorUser.email, sponsorSecret);
  adminHrAgent = await loginStaffAgent(adminHrUser.email, adminSecret);
  committeeAgent = await loginStaffAgent(committeeUser.email, committeeSecret);
  directorAgent = await loginStaffAgent(directorUser.email, directorSecret);
  securityAgent = await loginStaffAgent(securityUser.email, securitySecret);
  guideAgent = await loginStaffAgent(guideUser.email, guideSecret);

  studentAgent = request.agent(publicApp);
});

afterAll(async () => {
  const labApps = await owner.application.findMany({ where: { labId }, select: { id: true } });
  const appIds = labApps.map((a) => a.id);
  if (createdApplicationId && !appIds.includes(createdApplicationId)) {
    appIds.push(createdApplicationId);
  }

  if (appIds.length > 0) {
    await owner.certificate.deleteMany({ where: { applicationId: { in: appIds } } });
    await owner.attendance.deleteMany({ where: { applicationId: { in: appIds } } });
    await owner.joining.deleteMany({ where: { applicationId: { in: appIds } } });
    await owner.offer.deleteMany({ where: { applicationId: { in: appIds } } });
    await owner.review.deleteMany({ where: { applicationId: { in: appIds } } });
    await owner.directorateAssignment.deleteMany({ where: { applicationId: { in: appIds } } });
    await owner.document.deleteMany({ where: { applicationId: { in: appIds } } });
    await owner.applicationRevision.deleteMany({ where: { applicationId: { in: appIds } } });
    await owner.application.deleteMany({ where: { id: { in: appIds } } });
  }

  await owner.auditLog.deleteMany({
    where: {
      actorId: { in: [sponsorUser?.id, adminHrUser?.id, committeeUser?.id, directorUser?.id, securityUser?.id, guideUser?.id].filter(Boolean) },
    },
  });

  await owner.referralCode.deleteMany({ where: { labId } });
  await owner.sponsor.deleteMany({ where: { labId } });
  await owner.user.deleteMany({
    where: {
      id: { in: [sponsorUser?.id, adminHrUser?.id, committeeUser?.id, directorUser?.id, securityUser?.id, guideUser?.id].filter(Boolean) },
    },
  });
  await owner.directorate.deleteMany({ where: { id: directorateId } });
  await owner.lab.deleteMany({ where: { id: labId } });

  await owner.$disconnect();
  await publicDb.$disconnect();
  await internalDb.$disconnect();
});

describe('Full End-to-End Workflow & Milestone Verification', () => {
  it('M3: Sponsor creates referral code with quota tracking', async () => {
    const res = await sponsorAgent
      .post('/api/staff/referrals')
      .send({
        level: 'UG',
        studentName: 'Aarav Sharma',
        studentEmail,
      })
      .expect(200);

    expect(res.body.code).toBeDefined();
    expect(res.body.quotaRemaining).toBe(2); // 3 - 1 = 2
    issuedReferralCode = res.body.code;

    // Check my referrals list
    const listRes = await sponsorAgent
      .get('/api/staff/referrals/my')
      .expect(200);

    expect(listRes.body.referrals.length).toBe(1);
    expect(listRes.body.referrals[0].state).toBe('ACTIVE');
  });

  it('M3: Student redeems referral code and signs in with email OTP', async () => {
    // 1. Redeem preview
    const redeemRes = await studentAgent
      .post('/api/public/auth/redeem')
      .send({ code: issuedReferralCode })
      .expect(200);

    expect(redeemRes.body.referral.sponsorName).toBe('Test Sponsor');
    const referralToken = redeemRes.body.referralToken;

    // 2. Request OTP
    const otpRes = await studentAgent
      .post('/api/public/auth/otp/request')
      .send({ referralToken, email: studentEmail })
      .expect(202);

    const challengeId = otpRes.body.challengeId;
    const devCode = otpRes.body.devCode;

    // 3. Verify OTP
    const verifyRes = await studentAgent
      .post('/api/public/auth/otp/verify')
      .send({ challengeId, code: devCode })
      .expect(200);

    expect(verifyRes.body.applicationId).toBeDefined();
    expect(verifyRes.body.application.status).toBe('IN_PROGRESS');
    expect(verifyRes.body.application.editable).toBe(true);

    createdApplicationId = verifyRes.body.applicationId;
  });

  it('M4: Student drafts form and uploads mandatory college letter before submit', async () => {
    // Draft personal and academic info
    await studentAgent
      .put('/api/public/application/draft')
      .send({
        fullName: 'Aarav Sharma',
        dob: '2003-05-15',
        fatherName: 'Rajesh Sharma',
        gender: 'Male',
        nationality: 'Indian',
        aadhaarLast4: testAadhaar,
        phone: '9876543210',
        permanentAddress: '123 MG Road, Bengaluru',
        localAddress: '123 MG Road, Bengaluru',
        discipline: 'Aeronautical Engineering',
        branchCode: 'AE01',
        degree: 'B.Tech',
        semester: '6th',
        yearOfStudy: '3rd Year',
        cgpa: 8.75,
        durationWeeks: 16,
        startDate: '2026-06-01',
        endDate: '2026-09-20',
        topic: 'Aerodynamic Drag Minimization on Delta Wings',
        synopsis: 'A computational fluid dynamics study analyzing transonic flow separation and boundary layer control on delta wings.',
      })
      .expect(200);

    // Attempting submit without college letter fails (Rule 10 & Rule 2)
    const failSubmit = await studentAgent
      .post('/api/public/application/submit')
      .send({
        fullName: 'Aarav Sharma',
        dob: '2003-05-15',
        fatherName: 'Rajesh Sharma',
        gender: 'Male',
        nationality: 'Indian',
        aadhaarLast4: testAadhaar,
        phone: '9876543210',
        permanentAddress: '123 MG Road, Bengaluru',
        localAddress: '123 MG Road, Bengaluru',
        discipline: 'Aeronautical Engineering',
        branchCode: 'AE01',
        degree: 'B.Tech',
        semester: '6th',
        yearOfStudy: '3rd Year',
        cgpa: 8.75,
        durationWeeks: 16,
        startDate: '2026-06-01',
        endDate: '2026-09-20',
        topic: 'Aerodynamic Drag Minimization on Delta Wings',
        synopsis: 'A computational fluid dynamics study analyzing transonic flow separation and boundary layer control on delta wings.',
        declarationSigned: true,
      })
      .expect(400);

    expect(failSubmit.body.error.code).toBe('COLLEGE_LETTER_REQUIRED');

    // Upload college letter document
    const uploadRes = await studentAgent
      .post('/api/public/application/documents')
      .send({
        kind: 'COLLEGE_LETTER',
        fileName: 'college_recommendation_letter.pdf',
        mime: 'application/pdf',
        size: 1024,
        contentBase64: Buffer.from('PDF_COLLEGE_LETTER_DUMMY_CONTENT').toString('base64'),
      })
      .expect(201);

    expect(uploadRes.body.document.kind).toBe('COLLEGE_LETTER');
    expect(uploadRes.body.document.version).toBe(1);

    // Now submit succeeds
    const submitRes = await studentAgent
      .post('/api/public/application/submit')
      .send({
        fullName: 'Aarav Sharma',
        dob: '2003-05-15',
        fatherName: 'Rajesh Sharma',
        gender: 'Male',
        nationality: 'Indian',
        aadhaarLast4: testAadhaar,
        phone: '9876543210',
        permanentAddress: '123 MG Road, Bengaluru',
        localAddress: '123 MG Road, Bengaluru',
        discipline: 'Aeronautical Engineering',
        branchCode: 'AE01',
        degree: 'B.Tech',
        semester: '6th',
        yearOfStudy: '3rd Year',
        cgpa: 8.75,
        durationWeeks: 16,
        startDate: '2026-06-01',
        endDate: '2026-09-20',
        topic: 'Aerodynamic Drag Minimization on Delta Wings',
        synopsis: 'A computational fluid dynamics study analyzing transonic flow separation and boundary layer control on delta wings.',
        declarationSigned: true,
      })
      .expect(200);

    expect(submitRes.body.status).toBe('SUBMITTED');
    expect(submitRes.body.applicationNo).toMatch(/^ADA\/INT\/R\/2026\/\d{4}$/);
    expect(submitRes.body.revision).toBe(1);
  });

  it('M4: The same Aadhaar cannot be submitted twice in one intake year', async () => {
    const secondEmail = `second-${suffix}@college.edu.in`;
    const referral = await sponsorAgent
      .post('/api/staff/referrals')
      .send({ level: 'UG', studentName: 'Second Student', studentEmail: secondEmail })
      .expect(200);

    const secondAgent = request.agent(publicApp);
    const redeem = await secondAgent
      .post('/api/public/auth/redeem')
      .send({ code: referral.body.code })
      .expect(200);
    const otp = await secondAgent
      .post('/api/public/auth/otp/request')
      .send({ referralToken: redeem.body.referralToken, email: secondEmail })
      .expect(202);
    await secondAgent
      .post('/api/public/auth/otp/verify')
      .send({ challengeId: otp.body.challengeId, code: otp.body.devCode })
      .expect(200);

    await secondAgent
      .post('/api/public/application/documents')
      .send({
        kind: 'COLLEGE_LETTER',
        fileName: 'college_letter.pdf',
        mime: 'application/pdf',
        size: 1024,
        contentBase64: Buffer.from('PDF_DUPLICATE_AADHAAR').toString('base64'),
      })
      .expect(201);

    const res = await secondAgent
      .post('/api/public/application/submit')
      .send({
        fullName: 'Second Student',
        dob: '2003-01-01',
        fatherName: 'Second Parent',
        gender: 'Female',
        nationality: 'Indian',
        aadhaarLast4: testAadhaar,
        phone: '9876543211',
        permanentAddress: '45 Residency Road, Bengaluru',
        localAddress: '45 Residency Road, Bengaluru',
        discipline: 'Aeronautical Engineering',
        branchCode: 'AE01',
        degree: 'B.Tech',
        semester: '6th',
        yearOfStudy: '3rd Year',
        cgpa: 8.1,
        durationWeeks: 16,
        startDate: '2026-06-01',
        endDate: '2026-09-20',
        topic: 'Composite material fatigue testing',
        synopsis: 'Fatigue behaviour of carbon-fibre composite coupons under cyclic loading.',
        declarationSigned: true,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AADHAAR_ALREADY_USED');
  });

  it('M4: Student can edit while SUBMITTED, with revision history and optimistic lock', async () => {
    // 1. Edit submitted application
    const editRes = await studentAgent
      .patch('/api/public/application')
      .send({
        revision: 1,
        topic: 'Aerodynamic Drag Minimization on Modified Delta Wings',
      })
      .expect(200);

    expect(editRes.body.revision).toBe(2);
    expect(editRes.body.changedFields).toContain('topic');

    // 2. Concurrency conflict: sending stale revision (1 instead of 2) fails with 409
    const conflictRes = await studentAgent
      .patch('/api/public/application')
      .send({
        revision: 1,
        topic: 'Another change attempt',
      })
      .expect(409);

    expect(conflictRes.body.error.code).toBe('REVISION_MISMATCH');
  });

  it('M5: Admin & HR verifies letter, starts screening (locking student edits)', async () => {
    // 1. Admin verifies college letter
    await adminHrAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/verify-letter`)
      .expect(200);

    // 2. Admin starts HR screening
    const screenRes = await adminHrAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/screen`)
      .expect(200);

    expect(screenRes.body.status).toBe('HR_SCREENING');

    // 3. Student tries to edit while in HR_SCREENING: 403 Forbidden with lock notice!
    const lockRes = await studentAgent
      .patch('/api/public/application')
      .send({
        revision: 2,
        topic: 'Locked edit attempt',
      })
      .expect(403);

    expect(lockRes.body.error.code).toBe('EDIT_LOCKED');
    expect(lockRes.body.error.message).toContain('Admin & HR has started screening');
  });

  it('M5: Admin & HR assigns directorate & committee, Committee scores packet', async () => {
    // Admin assigns directorate and committee
    const assignRes = await adminHrAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/assign`)
      .send({
        directorateId,
        guideId: guideUser.id,
        committeeBatchId: 'BATCH-2026-A',
      })
      .expect(200);

    expect(assignRes.body.status).toBe('COMMITTEE_REVIEW');

    // Committee member reviews packet
    const reviewRes = await committeeAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/review`)
      .send({
        score: 92,
        remarks: 'Excellent academic background and relevant CFD project proposal.',
        recommendation: 'RECOMMEND',
      })
      .expect(200);

    expect(reviewRes.body.ok).toBe(true);

    // Packet status is now DIRECTOR_DECISION
    const packetRes = await adminHrAgent
      .get(`/api/staff/casework/applications/${createdApplicationId}`)
      .expect(200);

    expect(packetRes.body.application.status).toBe('DIRECTOR_DECISION');
  });

  it('M6: Director approves -> Offer issued -> Student accepts -> Seat ledger updates', async () => {
    // 1. Director approves
    const decideRes = await directorAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/decide`)
      .send({
        decision: 'APPROVE',
        reportingDate: '2026-06-01',
      })
      .expect(200);

    expect(decideRes.body.status).toBe('OFFER_ISSUED');

    // 2. Student views application with offer
    const appRes = await studentAgent
      .get('/api/public/application')
      .expect(200);

    expect(appRes.body.application.status).toBe('OFFER_ISSUED');
    expect(appRes.body.application.offer).toBeDefined();

    // 3. Student accepts offer
    const acceptRes = await studentAgent
      .post('/api/public/application/offer/respond')
      .send({ response: 'ACCEPT' })
      .expect(200);

    expect(acceptRes.body.status).toBe('ACCEPTED');

    // 4. Seat ledger updates: 1 occupied seat
    const ledgerRes = await adminHrAgent
      .get('/api/staff/casework/seats/ledger')
      .expect(200);

    expect(ledgerRes.body.summary.ug.occupied).toBeGreaterThanOrEqual(1);
  });

  it('M6: Reporting day Security pass -> In Training -> Attendance -> Completion -> Certificate with QR', async () => {
    // 1. Security verifies police clearance and ID proof
    await securityAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/verify-joining`)
      .expect(200);

    // 2. Security issues pass
    const passRes = await securityAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/issue-pass`)
      .send({ passNo: 'PASS-2026-042' })
      .expect(200);

    expect(passRes.body.status).toBe('IN_TRAINING');

    // 3. Guide enters attendance
    await guideAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/attendance`)
      .send({
        month: '2026-06',
        presentDays: 22,
        totalDays: 22,
      })
      .expect(200);

    // 4. Guide completes training
    const compRes = await guideAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/complete`)
      .expect(200);

    expect(compRes.body.status).toBe('COMPLETED');

    // 5. Admin & HR issues certificate
    const certRes = await adminHrAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/certificate`)
      .expect(200);

    expect(certRes.body.serialNo).toBeDefined();
    expect(certRes.body.status).toBe('CERTIFICATE_ISSUED');
    issuedSerialNo = certRes.body.serialNo;

    // 6. Duplicate issuance guard: issuing again fails with 409
    const dupRes = await adminHrAgent
      .post(`/api/staff/casework/applications/${createdApplicationId}/certificate`)
      .expect(409);

    expect(dupRes.body.error.code).toBe('CERTIFICATE_EXISTS');

    // 7. Public certificate verification works publicly without auth!
    const verifyPub = await request(publicApp)
      .get(`/api/public/info/certificates/verify/${encodeURIComponent(issuedSerialNo)}`)
      .expect(200);

    expect(verifyPub.body.valid).toBe(true);
    expect(verifyPub.body.traineeName).toBe('Aarav Sharma');
    expect(verifyPub.body.topic).toContain('Aerodynamic Drag Minimization');
  });
});

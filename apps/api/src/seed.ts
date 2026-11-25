/**
 * Seed - one account per role plus enough referral stock to sign in as a student.
 *
 * Deterministic, re-runnable (upserts). TOTP secrets are derived from the email
 * so the printed table stays true across re-seeds; this is a development
 * convenience and is never how a real secret would be generated.
 */
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadEnv } from './config/env.js';
import { base32Encode, generateReferralBody, hmacHex, sha256Hex } from './lib/crypto.js';
import { formatReferralCode, permissionsForRole, ROLE_LABELS, type Role } from '@ada/shared';

process.env.ZONE ??= 'internal';
// Seeding writes with the schema owner's credentials, never a zone runtime role.
process.env.DATABASE_URL ??= process.env.MIGRATION_DATABASE_URL;
const env = loadEnv();

const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const INTAKE_YEAR = 2026;
const QUOTA_YEAR = 2026;

const totpSecretFor = (email: string): string =>
  base32Encode(createHash('sha256').update(`ada-portal-seed:${email}`).digest().subarray(0, 20));

interface SeedAccount {
  role: Role;
  name: string;
  email: string;
  employeeCode: string;
  directorate?: string;
}

const ACCOUNTS: SeedAccount[] = [
  { role: 'ADMIN_HR', name: 'Meera Raghavan', email: 'admin.hr@ada.gov.in', employeeCode: 'ADA-1001', directorate: 'ADMIN' },
  { role: 'DIRECTOR', name: 'Air Cmde S. Nair', email: 'director@ada.gov.in', employeeCode: 'ADA-1002', directorate: 'ADMIN' },
  { role: 'COMMITTEE', name: 'Dr. K. Venkatesh', email: 'committee@ada.gov.in', employeeCode: 'ADA-2001', directorate: 'AVIONICS' },
  { role: 'SECURITY', name: 'R. Prasad', email: 'security@ada.gov.in', employeeCode: 'ADA-3001' },
  { role: 'GUIDE', name: 'Dr. Anil Kumar', email: 'guide@ada.gov.in', employeeCode: 'ADA-2002', directorate: 'AVIONICS' },
  { role: 'DIRECTORATE_HEAD', name: 'Smt. L. Iyer', email: 'dh.lrde@ada.gov.in', employeeCode: 'ADA-2003', directorate: 'AVIONICS' },
  { role: 'SPONSOR', name: 'Vikram Shetty', email: 'sponsor.lrde@ada.gov.in', employeeCode: 'LRDE-4410' },
];

const DIRECTORATES = [
  { code: 'ADMIN', name: 'Admin & HR', ug: 0, pg: 0 },
  { code: 'AVIONICS', name: 'Avionics & Mission Systems', ug: 18, pg: 10 },
  { code: 'AIRFRAME', name: 'Airframe & Structures', ug: 16, pg: 8 },
  { code: 'PROPULSION', name: 'Propulsion', ug: 10, pg: 5 },
  { code: 'FLIGHT_TEST', name: 'Flight Test & Evaluation', ug: 6, pg: 2 },
];

const LABS = [
  { code: 'ADA', name: 'Aeronautical Development Agency', type: 'ADA' as const },
  { code: 'LRDE', name: 'Electronics & Radar Development Establishment', type: 'DRDO_OTHER' as const },
  { code: 'CABS', name: 'Centre for Airborne Systems', type: 'DRDO_OTHER' as const },
  { code: 'ADE', name: 'Aeronautical Development Establishment', type: 'DRDO_OTHER' as const },
  { code: 'GTRE', name: 'Gas Turbine Research Establishment', type: 'DRDO_OTHER' as const },
];

const FLAGS = [
  { key: 'public_status_check', zonePublic: true, zoneInternal: true, isHardInternal: false, description: 'Application status check by number and DOB' },
  { key: 'public_certificate_verify', zonePublic: true, zoneInternal: true, isHardInternal: false, description: 'Certificate verification by serial and QR' },
  { key: 'staff_config_ui', zonePublic: false, zoneInternal: true, isHardInternal: true, description: 'Configuration screen (intranet only)' },
  { key: 'committee_scoring', zonePublic: false, zoneInternal: true, isHardInternal: true, description: 'Committee scoring (intranet only)' },
  { key: 'referral_issue', zonePublic: false, zoneInternal: true, isHardInternal: true, description: 'Referral code issue (intranet only)' },
  { key: 'open_application_form', zonePublic: false, zoneInternal: false, isHardInternal: false, description: 'Open channel - disabled by policy' },
];

const main = async (): Promise<void> => {
  const directorateIds = new Map<string, string>();
  for (const row of DIRECTORATES) {
    const created = await prisma.directorate.upsert({
      where: { code: row.code },
      update: { name: row.name, ugCapacity: row.ug, pgCapacity: row.pg },
      create: { code: row.code, name: row.name, ugCapacity: row.ug, pgCapacity: row.pg },
    });
    directorateIds.set(row.code, created.id);
  }

  const labIds = new Map<string, string>();
  for (const row of LABS) {
    const created = await prisma.lab.upsert({
      where: { code: row.code },
      update: { name: row.name, type: row.type },
      create: { code: row.code, name: row.name, type: row.type },
    });
    labIds.set(row.code, created.id);
  }

  await prisma.intakeYear.upsert({
    where: { year: INTAKE_YEAR },
    update: { seatPlanPublishedAt: new Date(`${INTAKE_YEAR}-01-15T00:00:00Z`), noticeVersion: 'December 2025 notice' },
    create: {
      year: INTAKE_YEAR,
      seatPlanPublishedAt: new Date(`${INTAKE_YEAR}-01-15T00:00:00Z`),
      noticeVersion: 'December 2025 notice',
      openChannelEnabled: false,
    },
  });

  const users: Record<string, { id: string; role: Role; email: string; secret: string }> = {};
  for (const account of ACCOUNTS) {
    const secret = totpSecretFor(account.email);
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        role: account.role,
        name: account.name,
        employeeCode: account.employeeCode,
        isActive: true,
        totpSecret: secret,
        totpEnrolledAt: new Date(),
        directorateId: account.directorate ? (directorateIds.get(account.directorate) ?? null) : null,
      },
      create: {
        role: account.role,
        name: account.name,
        email: account.email,
        employeeCode: account.employeeCode,
        isActive: true,
        totpSecret: secret,
        totpEnrolledAt: new Date(),
        directorateId: account.directorate ? (directorateIds.get(account.directorate) ?? null) : null,
      },
    });
    users[account.role] = { id: user.id, role: account.role, email: user.email, secret };
  }

  const sponsorUser = users.SPONSOR!;
  const sponsor = await prisma.sponsor.upsert({
    where: { officialEmail_quotaYear: { officialEmail: sponsorUser.email, quotaYear: QUOTA_YEAR } },
    update: { labId: labIds.get('LRDE')!, userId: sponsorUser.id, fullName: 'Vikram Shetty' },
    create: {
      labId: labIds.get('LRDE')!,
      userId: sponsorUser.id,
      fullName: 'Vikram Shetty',
      officialEmail: sponsorUser.email,
      employeeRef: 'LRDE-4410',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      quotaYear: QUOTA_YEAR,
      quotaUsed: 0,
    },
  });

  for (const flag of FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {
        zonePublic: flag.zonePublic,
        zoneInternal: flag.zoneInternal,
        isHardInternal: flag.isHardInternal,
        description: flag.description,
      },
      create: flag,
    });
  }

  // --- referral codes: printed once, stored only as HMAC -------------------
  const issued: string[] = [];
  const existingCodes = await prisma.referralCode.count({ where: { sponsorId: sponsor.id, intakeYear: INTAKE_YEAR } });
  if (existingCodes === 0) {
    const plans = [
      { level: 'UG' as const, days: 45 },
      { level: 'UG' as const, days: 45 },
      { level: 'PG' as const, days: 45 },
    ];
    for (const plan of plans) {
      const body = generateReferralBody();
      const code = formatReferralCode('LRDE-26', body);
      await prisma.referralCode.create({
        data: {
          codeHmac: hmacHex(code, env.REFERRAL_HMAC_PEPPER),
          codePrefix: 'LRDE-26',
          sponsorId: sponsor.id,
          labId: labIds.get('LRDE')!,
          level: plan.level,
          intakeYear: INTAKE_YEAR,
          expiresAt: new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000),
          issuedBy: sponsorUser.id,
          issuedZone: 'internal',
        },
      });
      issued.push(`${code}  (${plan.level})`);
    }
  }

  // --- one seeded application, so the intranet has a packet to look at -----
  const seededStudent = await prisma.student.upsert({
    where: { email_intakeYear: { email: 'ananya.iyer@example.edu.in', intakeYear: INTAKE_YEAR } },
    update: {},
    create: {
      fullName: 'Ananya Iyer',
      dob: new Date('2003-04-18T00:00:00Z'),
      fatherName: 'S. Iyer',
      gender: 'Female',
      nationality: 'Indian',
      aadhaarLast4: '4821',
      aadhaarRefHash: hmacHex('seed-aadhaar-ananya', env.REFERRAL_HMAC_PEPPER),
      email: 'ananya.iyer@example.edu.in',
      phone: '+91 98xxxxxx21',
      permanentAddress: 'Bengaluru, Karnataka',
      intakeYear: INTAKE_YEAR,
    },
  });

  const existingApplication = await prisma.application.findFirst({
    where: { studentId: seededStudent.id, intakeYear: INTAKE_YEAR },
  });

  if (!existingApplication) {
    const application = await prisma.application.create({
      data: {
        applicationNo: `ADA/INT/R/${INTAKE_YEAR}/0001`,
        entryChannel: 'REFERRED',
        sponsorId: sponsor.id,
        labId: labIds.get('LRDE')!,
        studentId: seededStudent.id,
        level: 'UG',
        discipline: 'Electronics & Communication',
        branchCode: 'EC',
        degree: 'B.E.',
        semester: '7',
        yearOfStudy: '4',
        cgpa: 8.4,
        durationWeeks: 16,
        startDate: new Date(`${INTAKE_YEAR}-01-05T00:00:00Z`),
        endDate: new Date(`${INTAKE_YEAR}-04-26T00:00:00Z`),
        topic: 'Signal processing for airborne radar',
        synopsis:
          'Study of clutter suppression techniques for an airborne pulse-Doppler radar, with a simulation of the effect of platform motion on target detection.',
        status: 'SUBMITTED',
        revision: 1,
        intakeYear: INTAKE_YEAR,
        submittedAt: new Date(),
        lastEditedAt: new Date(),
      },
    });

    await prisma.applicationRevision.create({
      data: {
        applicationId: application.id,
        revisionNo: 1,
        snapshotJson: { status: 'SUBMITTED', level: 'UG', topic: 'Signal processing for airborne radar' },
        changedFields: ['status'],
        sha256: sha256Hex(`${application.id}:1`),
        ip: '127.0.0.1',
      },
    });

    const file = await prisma.fileObject.create({
      data: {
        storageKey: `seed/college-letter-${application.id}.pdf`,
        mime: 'application/pdf',
        size: 182_344,
        sha256: sha256Hex('seed college letter'),
        uploadedBy: null,
        scanStatus: 'PENDING',
      },
    });

    await prisma.document.create({
      data: {
        applicationId: application.id,
        kind: 'COLLEGE_LETTER',
        version: 1,
        fileId: file.id,
        sha256: file.sha256,
      },
    });
  }

  const rows = ACCOUNTS.map((account) => {
    const permissions = permissionsForRole(account.role);
    return {
      role: account.role,
      label: ROLE_LABELS[account.role],
      email: account.email,
      totpSecret: users[account.role]!.secret,
      permissions: permissions.length,
    };
  });

  const width = Math.max(...rows.map((row) => row.email.length));
  console.log('\nADA portal - seeded staff accounts (development only)\n');
  console.log(`${'ROLE'.padEnd(17)}${'EMAIL'.padEnd(width + 3)}PERMS  TOTP SECRET`);
  console.log('-'.repeat(17 + width + 3 + 7 + 32));
  for (const row of rows) {
    console.log(`${row.role.padEnd(17)}${row.email.padEnd(width + 3)}${String(row.permissions).padEnd(7)}${row.totpSecret}`);
  }

  if (issued.length > 0) {
    console.log('\nReferral codes issued just now - shown once, cannot be recovered:\n');
    for (const code of issued) console.log(`  ${code}`);
    console.log('');
  } else {
    console.log('\nReferral codes already exist for this sponsor and intake year (not re-printed).\n');
  }

  console.log(`Seeded application: ADA/INT/R/${INTAKE_YEAR}/0001 (SUBMITTED) for ananya.iyer@example.edu.in\n`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

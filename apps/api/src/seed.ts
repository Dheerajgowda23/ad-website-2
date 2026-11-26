/**
 * Seed - one account per role, demo applications at every pipeline stage, and
 * enough referral stock to sign in as a student.
 *
 * Deterministic, re-runnable (upserts). TOTP secrets are derived from the email
 * so the printed table stays true across re-seeds; this is a development
 * convenience and is never how a real secret would be generated.
 */
import { createHash } from 'node:crypto';
import { PrismaClient, type ApplicationStatus } from '@prisma/client';
import { loadEnv } from './config/env.js';
import { base32Encode, generateReferralBody, hmacHex, sha256Hex } from './lib/crypto.js';
import {
  formatApplicationNo,
  formatReferralCode,
  permissionsForRole,
  ROLE_LABELS,
  type Level,
  type Role,
} from '@ada/shared';

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

interface SeedApplication {
  seq: number;
  name: string;
  email: string;
  dob: string;
  fatherName: string;
  gender: string;
  aadhaarLast4: string;
  phone: string;
  address: string;
  collegeName: string;
  universityName: string;
  rollNumber: string;
  level: Level;
  discipline: string;
  branchCode: string;
  cgpa: number;
  topic: string;
  synopsis: string;
  status: ApplicationStatus;
  collegeLetter?: boolean;
  reportingDate?: string;
  rejectionReasonCode?: string;
}

/**
 * One student per pipeline stage, so both dashboards and the public status page
 * have something to show. Dates of birth are what the status check asks for.
 */
const TEST_APPLICATIONS: SeedApplication[] = [
  {
    seq: 1,
    name: 'Ananya Iyer',
    email: 'ananya.iyer@example.edu.in',
    dob: '2003-04-18',
    fatherName: 'S. Iyer',
    gender: 'Female',
    aadhaarLast4: '4821',
    phone: '+91 98xxxxxx21',
    address: 'Bengaluru, Karnataka',
    collegeName: 'BMS College of Engineering',
    universityName: 'Visvesvaraya Technological University',
    rollNumber: '1BM21EC042',
    level: 'UG',
    discipline: 'Electronics & Communication',
    branchCode: 'EC',
    cgpa: 8.4,
    topic: 'Signal processing for airborne radar',
    synopsis:
      'Study of clutter suppression techniques for an airborne pulse-Doppler radar, with a simulation of the effect of platform motion on target detection.',
    status: 'SUBMITTED',
    collegeLetter: true,
  },
  {
    seq: 2,
    name: 'Rohan Mehta',
    email: 'rohan.mehta@example.edu.in',
    dob: '2002-11-02',
    fatherName: 'A. Mehta',
    gender: 'Male',
    aadhaarLast4: '7315',
    phone: '+91 98xxxxxx34',
    address: 'Pune, Maharashtra',
    collegeName: 'College of Engineering, Pune',
    universityName: 'Savitribai Phule Pune University',
    rollNumber: 'COEP21ME118',
    level: 'UG',
    discipline: 'Mechanical Engineering',
    branchCode: 'ME',
    cgpa: 7.9,
    topic: 'Thermal modelling of an avionics cooling duct',
    synopsis:
      'Lumped-parameter and CFD comparison of forced convection in a fighter avionics bay cooling duct, with a sensitivity study on inlet temperature.',
    status: 'HR_SCREENING',
    collegeLetter: true,
  },
  {
    seq: 3,
    name: 'Priya Nair',
    email: 'priya.nair@example.edu.in',
    dob: '2001-06-25',
    fatherName: 'M. Nair',
    gender: 'Female',
    aadhaarLast4: '2094',
    phone: '+91 98xxxxxx57',
    address: 'Thiruvananthapuram, Kerala',
    collegeName: 'Indian Institute of Technology Madras',
    universityName: 'Indian Institute of Technology Madras',
    rollNumber: 'AE22M0117',
    level: 'PG',
    discipline: 'Aerospace Engineering',
    branchCode: 'AE',
    cgpa: 8.8,
    topic: 'Flutter margin estimation for a composite wing',
    synopsis:
      'Reduced-order aeroelastic model of a composite UAV wing, comparing predicted flutter margins from ground vibration test data with wind tunnel results.',
    status: 'COMMITTEE_REVIEW',
    collegeLetter: true,
  },
  {
    seq: 4,
    name: 'Karthik Rao',
    email: 'karthik.rao@example.edu.in',
    dob: '2003-01-14',
    fatherName: 'V. Rao',
    gender: 'Male',
    aadhaarLast4: '5580',
    phone: '+91 98xxxxxx63',
    address: 'Hyderabad, Telangana',
    collegeName: 'International Institute of Information Technology',
    universityName: 'Jawaharlal Nehru Technological University',
    rollNumber: 'IIIT21CS09',
    level: 'UG',
    discipline: 'Computer Science',
    branchCode: 'CS',
    cgpa: 9.1,
    topic: 'Mission-planning UI for a ground control station',
    synopsis:
      'Prototype of a tablet-first mission planning interface for a ground control station, evaluated with two operators on a simulated sortie.',
    status: 'OFFER_ISSUED',
    collegeLetter: true,
    reportingDate: '2026-01-05',
  },
  {
    seq: 5,
    name: 'Meghna Das',
    email: 'meghna.das@example.edu.in',
    dob: '2002-08-09',
    fatherName: 'P. Das',
    gender: 'Female',
    aadhaarLast4: '9167',
    phone: '+91 98xxxxxx78',
    address: 'Bhubaneswar, Odisha',
    collegeName: 'NIT Rourkela',
    universityName: 'NIT Rourkela',
    rollNumber: '121EE0452',
    level: 'UG',
    discipline: 'Electrical Engineering',
    branchCode: 'EE',
    cgpa: 6.4,
    topic: 'Power electronics for a radar transmitter',
    synopsis:
      'Survey of high-voltage converter topologies for a pulsed radar transmitter, with loss comparison for two candidate designs.',
    status: 'REJECTED_ELIGIBILITY',
    rejectionReasonCode: 'CGPA_BELOW_MINIMUM',
    collegeLetter: true,
  },
  {
    seq: 6,
    name: 'Arjun Pillai',
    email: 'arjun.pillai@example.edu.in',
    dob: '2003-09-30',
    fatherName: 'K. Pillai',
    gender: 'Male',
    aadhaarLast4: '3378',
    phone: '+91 98xxxxxx85',
    address: 'Chennai, Tamil Nadu',
    collegeName: 'SRM Institute of Science and Technology',
    universityName: 'SRM Institute of Science and Technology',
    rollNumber: 'RA2111003010',
    level: 'UG',
    discipline: 'Information Technology',
    branchCode: 'IT',
    cgpa: 8.0,
    topic: 'Telemetry dashboard for flight test data',
    synopsis:
      'Streaming dashboard for post-flight telemetry, with parameter grouping and a replay timeline for test engineers.',
    status: 'IN_PROGRESS',
  },
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

  // --- demo applications, one per pipeline stage ---------------------------
  const seededApplications: { applicationNo: string; status: string; email: string; dob: string }[] = [];
  for (const plan of TEST_APPLICATIONS) {
    const student = await prisma.student.upsert({
      where: { email_intakeYear: { email: plan.email, intakeYear: INTAKE_YEAR } },
      update: {},
      create: {
        fullName: plan.name,
        dob: new Date(`${plan.dob}T00:00:00Z`),
        fatherName: plan.fatherName,
        gender: plan.gender,
        nationality: 'Indian',
        aadhaarLast4: plan.aadhaarLast4,
        aadhaarRefHash: hmacHex(`seed-aadhaar-${plan.email}`, env.REFERRAL_HMAC_PEPPER),
        email: plan.email,
        phone: plan.phone,
        permanentAddress: plan.address,
        collegeName: plan.collegeName,
        universityName: plan.universityName,
        rollNumber: plan.rollNumber,
        intakeYear: INTAKE_YEAR,
      },
    });

    const applicationNo = formatApplicationNo('REFERRED', INTAKE_YEAR, plan.seq);
    const existing = await prisma.application.findFirst({
      where: { studentId: student.id, intakeYear: INTAKE_YEAR },
    });
    if (existing) {
      seededApplications.push({ applicationNo: existing.applicationNo ?? applicationNo, status: plan.status, email: plan.email, dob: plan.dob });
      continue;
    }

    const submitted = plan.status !== 'IN_PROGRESS';
    const application = await prisma.application.create({
      data: {
        applicationNo,
        entryChannel: 'REFERRED',
        sponsorId: sponsor.id,
        labId: labIds.get('LRDE')!,
        studentId: student.id,
        level: plan.level,
        discipline: plan.discipline,
        branchCode: plan.branchCode,
        degree: plan.level === 'UG' ? 'B.E.' : 'M.Tech',
        semester: plan.level === 'UG' ? '7' : '1',
        yearOfStudy: plan.level === 'UG' ? '4' : '1',
        cgpa: plan.cgpa,
        durationWeeks: 16,
        startDate: new Date(`${INTAKE_YEAR}-01-05T00:00:00Z`),
        endDate: new Date(`${INTAKE_YEAR}-04-26T00:00:00Z`),
        topic: plan.topic,
        synopsis: plan.synopsis,
        status: plan.status,
        revision: submitted ? 1 : 0,
        intakeYear: INTAKE_YEAR,
        submittedAt: submitted ? new Date() : null,
        lastEditedAt: new Date(),
        rejectionReasonCode: plan.rejectionReasonCode ?? null,
      },
    });

    if (submitted) {
      await prisma.applicationRevision.create({
        data: {
          applicationId: application.id,
          revisionNo: 1,
          snapshotJson: { status: plan.status, level: plan.level, topic: plan.topic },
          changedFields: ['status'],
          sha256: sha256Hex(`${application.id}:1`),
          ip: '127.0.0.1',
        },
      });
    }

    if (plan.collegeLetter) {
      const file = await prisma.fileObject.create({
        data: {
          storageKey: `seed/college-letter-${application.id}.pdf`,
          mime: 'application/pdf',
          size: 182_344,
          sha256: sha256Hex(`seed college letter ${plan.email}`),
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

    if (plan.reportingDate) {
      await prisma.offer.create({
        data: {
          applicationId: application.id,
          guideId: users.GUIDE?.id ?? null,
          issuedAt: new Date(),
          reportingDate: new Date(`${plan.reportingDate}T00:00:00Z`),
        },
      });
    }

    seededApplications.push({ applicationNo, status: plan.status, email: plan.email, dob: plan.dob });
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

  console.log('Demo applications - the public status check needs the number and the date of birth:\n');
  console.log(`${'APPLICATION NO'.padEnd(24)}${'STATUS'.padEnd(22)}${'DATE OF BIRTH'.padEnd(15)}EMAIL`);
  console.log('-'.repeat(24 + 22 + 15 + 30));
  for (const row of seededApplications) {
    console.log(`${row.applicationNo.padEnd(24)}${row.status.padEnd(22)}${row.dob.padEnd(15)}${row.email}`);
  }
  console.log('');
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

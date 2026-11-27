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
import { base32Encode, hmacHex, sha256Hex } from './lib/crypto.js';
import {
  checksumForBody,
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
const COLLEGES = [
  ['BMS College of Engineering', 'Visvesvaraya Technological University', 'Bengaluru, Karnataka'],
  ['College of Engineering, Pune', 'Savitribai Phule Pune University', 'Pune, Maharashtra'],
  ['NIT Rourkela', 'NIT Rourkela', 'Bhubaneswar, Odisha'],
  ['SRM Institute of Science and Technology', 'SRM Institute of Science and Technology', 'Chennai, Tamil Nadu'],
  ['VIT Vellore', 'VIT Vellore', 'Vellore, Tamil Nadu'],
];
const FATHERS = ['S. Rao', 'A. Mehta', 'M. Nair', 'V. Reddy', 'P. Das', 'K. Pillai'];

/** Fills the boilerplate for the demonstration cases below seq 7. */
const extraApp = (
  seq: number,
  name: string,
  email: string,
  dob: string,
  level: Level,
  status: ApplicationStatus,
  topic: string,
): SeedApplication => {
  const college = COLLEGES[seq % COLLEGES.length]!;
  return {
    seq,
    name,
    email,
    dob,
    fatherName: FATHERS[seq % FATHERS.length]!,
    gender: seq % 2 === 0 ? 'Female' : 'Male',
    aadhaarLast4: String(1000 + ((seq * 733) % 9000)),
    phone: `9${String(800000000 + seq * 1234567).slice(-9)}`,
    address: `${seq + 10}, ${college[2]}`,
    collegeName: college[0]!,
    universityName: college[1]!,
    rollNumber: `1AD${21 + (seq % 4)}${level === 'PG' ? 'M' : 'E'}${String(seq).padStart(3, '0')}`,
    level,
    discipline: level === 'PG' ? 'Aerospace Engineering' : 'Electronics & Communication',
    branchCode: level === 'PG' ? 'AE' : 'EC',
    cgpa: Number((7 + (seq % 18) / 10).toFixed(1)),
    topic,
    synopsis: `${topic}. Seeded case so the ${status} screen has a real packet to open.`,
    status,
    collegeLetter: !['INVITED', 'IN_PROGRESS'].includes(status),
  };
};

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
  // --- one case for every remaining status ---------------------------------
  extraApp(7, 'Aisha Khan', 'aisha.khan@example.edu.in', '2003-05-22', 'UG', 'INVITED', 'Human factors in cockpit display design'),
  extraApp(8, 'Vikram Joshi', 'vikram.joshi@example.edu.in', '2002-03-16', 'UG', 'RETURNED_FOR_CORRECTION', 'Vibration isolation for an avionics rack'),
  extraApp(9, 'Neha Reddy', 'neha.reddy@example.edu.in', '2001-09-27', 'PG', 'NOT_RECOMMENDED', 'Guidance law tuning for a terminal-phase interceptor'),
  extraApp(10, 'Aditya Kulkarni', 'aditya.kulkarni@example.edu.in', '2003-06-08', 'UG', 'DIRECTOR_DECISION', 'Loads estimation from strain-gauge data'),
  extraApp(11, 'Farhan Ali', 'farhan.ali@example.edu.in', '2002-12-01', 'UG', 'REJECTED', 'Wireless harness reduction in an avionics bay'),
  extraApp(12, 'Kavya Menon', 'kavya.menon@example.edu.in', '2003-03-05', 'UG', 'ACCEPTED', 'Cockpit alerting logic for degraded navigation'),
  extraApp(13, 'Rahul Verma', 'rahul.verma@example.edu.in', '2002-10-12', 'UG', 'DOCUMENT_VERIFIED', 'Test-rig instrumentation for a hydraulic actuator'),
  extraApp(14, 'Sneha Pillai', 'sneha.pillai@example.edu.in', '2003-07-30', 'UG', 'SECURITY_PASS', 'Corrosion inspection of a wing attachment fitting'),
  extraApp(15, 'Aman Gupta', 'aman.gupta@example.edu.in', '2002-05-04', 'UG', 'IN_TRAINING', 'Telemetry ground-station antenna tracker'),
  extraApp(16, 'Ritu Shah', 'ritu.shah@example.edu.in', '2003-08-21', 'UG', 'COMPLETED', 'Fatigue life estimate for a landing-gear bracket'),
  extraApp(17, 'Suresh Babu', 'suresh.babu@example.edu.in', '2001-11-11', 'PG', 'CERTIFICATE_ISSUED', 'Radar cross-section measurement techniques'),
  extraApp(18, 'Tanvi Desai', 'tanvi.desai@example.edu.in', '2003-01-19', 'UG', 'WITHDRAWN', 'Thermal analysis of a fuel-cooled heat exchanger'),
  extraApp(19, 'Manish Yadav', 'manish.yadav@example.edu.in', '2002-04-02', 'UG', 'CANCELLED', 'Mission computer software test harness'),
  extraApp(20, 'Pooja Hegde', 'pooja.hegde@example.edu.in', '2003-10-15', 'UG', 'EXPIRED', 'Air-data probe calibration rig'),
];

// Which related rows a status implies, so every screen has the data it reads.
const COMMITTEE_BATCH = 'BATCH-2026-01';
const daysFromNow = (days: number): Date => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const OFFER_STATUSES: ApplicationStatus[] = [
  'OFFER_ISSUED',
  'ACCEPTED',
  'DOCUMENT_VERIFIED',
  'SECURITY_PASS',
  'IN_TRAINING',
  'COMPLETED',
  'CERTIFICATE_ISSUED',
];
const ACCEPTED_STATUSES: ApplicationStatus[] = OFFER_STATUSES.slice(1);
const PASS_STATUSES: ApplicationStatus[] = ['SECURITY_PASS', 'IN_TRAINING', 'COMPLETED', 'CERTIFICATE_ISSUED'];
const TRAINING_STATUSES: ApplicationStatus[] = ['IN_TRAINING', 'COMPLETED', 'CERTIFICATE_ISSUED'];
const VERIFIED_DOC_STATUSES: ApplicationStatus[] = ['DOCUMENT_VERIFIED', ...PASS_STATUSES];
const DIRECTORATE_STATUSES: ApplicationStatus[] = [
  'COMMITTEE_REVIEW',
  'DIRECTOR_DECISION',
  ...OFFER_STATUSES,
  'NOT_RECOMMENDED',
  'REJECTED',
];
const DECIDED_STATUSES: ApplicationStatus[] = ['DIRECTOR_DECISION', ...OFFER_STATUSES, 'NOT_RECOMMENDED', 'REJECTED'];
const REVIEWED_STATUSES: ApplicationStatus[] = ['DIRECTOR_DECISION', ...OFFER_STATUSES, 'NOT_RECOMMENDED', 'REJECTED'];
// Demo codes that show the sponsor screen's other states without being usable.
const SPENT_REFERRALS: { payload: string; level: Level; state: 'REVOKED' | 'EXPIRED' }[] = [
  { payload: 'DEMREV2', level: 'UG', state: 'REVOKED' },
  { payload: 'DEMEXP3', level: 'PG', state: 'EXPIRED' },
];

interface SeedReferral {
  /** Seven symbols from the code alphabet; the checksum symbol is appended. */
  payload: string;
  level: Level;
  student: SeedApplication;
}

/**
 * Student sign-in data. Each code is fixed (not random) and always printed, so
 * the same three codes work on every demo install and can be written down.
 *
 * The student row is seeded with the full profile but no application: signing in
 * with the code creates the application, which then opens with these personal
 * and college fields already filled in.
 */
const TEST_REFERRALS: SeedReferral[] = [
  {
    payload: 'DEMUG23',
    level: 'UG',
    student: {
      seq: 0,
      name: 'Sneha Kulkarni',
      email: 'sneha.kulkarni@example.edu.in',
      dob: '2003-02-11',
      fatherName: 'R. Kulkarni',
      gender: 'Female',
      aadhaarLast4: '6142',
      phone: '9845012345',
      address: '14, Jayanagar 4th Block, Bengaluru, Karnataka 560011',
      collegeName: 'RV College of Engineering',
      universityName: 'Visvesvaraya Technological University',
      rollNumber: '1RV21AE067',
      level: 'UG',
      discipline: 'Aerospace Engineering',
      branchCode: 'AE',
      cgpa: 8.6,
      topic: 'Structural health monitoring of a composite wing spar',
      synopsis:
        'Embedded piezoelectric sensors on a composite wing spar, with a damage index computed from guided-wave signals and compared against a finite-element model.',
      status: 'SUBMITTED',
    },
  },
  {
    payload: 'DEMUG47',
    level: 'UG',
    student: {
      seq: 0,
      name: 'Imran Sheikh',
      email: 'imran.sheikh@example.edu.in',
      dob: '2002-07-19',
      fatherName: 'A. Sheikh',
      gender: 'Male',
      aadhaarLast4: '8873',
      phone: '9900123456',
      address: '22, Shivajinagar, Pune, Maharashtra 411005',
      collegeName: 'M. S. Ramaiah Institute of Technology',
      universityName: 'Visvesvaraya Technological University',
      rollNumber: '1MS21CS104',
      level: 'UG',
      discipline: 'Computer Science',
      branchCode: 'CS',
      cgpa: 8.1,
      topic: 'Flight-test telemetry visualisation dashboard',
      synopsis:
        'Web dashboard that replays post-flight telemetry with synchronised parameter plots, event markers and a shared timeline for test engineers.',
      status: 'SUBMITTED',
    },
  },
  {
    payload: 'DEMPG58',
    level: 'PG',
    student: {
      seq: 0,
      name: 'Divya Menon',
      email: 'divya.menon@example.edu.in',
      dob: '2000-12-08',
      fatherName: 'S. Menon',
      gender: 'Female',
      aadhaarLast4: '4520',
      phone: '9880012345',
      address: '7, Kalyan Nagar, Bengaluru, Karnataka 560043',
      collegeName: 'Indian Institute of Science',
      universityName: 'Indian Institute of Science',
      rollNumber: 'AE24M0032',
      level: 'PG',
      discipline: 'Aerospace Engineering',
      branchCode: 'AE',
      cgpa: 9.0,
      topic: 'Aeroelastic tailoring of a composite UAV wing',
      synopsis:
        'Ply-orientation study of a composite UAV wing to push flutter speed up without adding mass, validated against a reduced-order aeroelastic model.',
      status: 'SUBMITTED',
    },
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

  // One committee batch, so the COMMITTEE account can score the review case.
  await prisma.committeeAssignment.upsert({
    where: { batchId_userId: { batchId: COMMITTEE_BATCH, userId: users.COMMITTEE!.id } },
    update: { isActive: true },
    create: {
      intakeYear: INTAKE_YEAR,
      batchId: COMMITTEE_BATCH,
      userId: users.COMMITTEE!.id,
      role: 'MEMBER',
      assignedBy: users.ADMIN_HR!.id,
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

  // --- referral codes: fixed bodies, printed every run, stored only as HMAC --
  const referralRows: { code: string; level: Level; name: string; email: string; dob: string; state: string }[] = [];
  for (const plan of TEST_REFERRALS) {
    const body = `${plan.payload}${checksumForBody(plan.payload)}`;
    const code = formatReferralCode('LRDE-26', body);
    const codeHmac = hmacHex(code, env.REFERRAL_HMAC_PEPPER);
    const profile = plan.student;

    // The profile behind the code. No application: the application is created
    // when the student redeems the code, and opens with these fields filled in.
    await prisma.student.upsert({
      where: { email_intakeYear: { email: profile.email, intakeYear: INTAKE_YEAR } },
      update: {},
      create: {
        fullName: profile.name,
        dob: new Date(`${profile.dob}T00:00:00Z`),
        fatherName: profile.fatherName,
        gender: profile.gender,
        nationality: 'Indian',
        aadhaarLast4: profile.aadhaarLast4,
        aadhaarRefHash: hmacHex(`seed-aadhaar-${profile.email}`, env.REFERRAL_HMAC_PEPPER),
        email: profile.email,
        phone: profile.phone,
        permanentAddress: profile.address,
        localAddress: profile.address,
        collegeName: profile.collegeName,
        universityName: profile.universityName,
        rollNumber: profile.rollNumber,
        collegeAddress: `${profile.collegeName}, Bengaluru, Karnataka 560001`,
        category: 'GENERAL',
        intakeYear: INTAKE_YEAR,
      },
    });

    const existing = await prisma.referralCode.findUnique({ where: { codeHmac } });
    let state = 'ready';
    if (existing) {
      state = existing.usedByApplicationId
        ? 'USED'
        : existing.revokedAt
          ? 'REVOKED'
          : existing.boundStudentEmail
            ? 'BOUND'
            : existing.expiresAt.getTime() < Date.now()
              ? 'EXPIRED'
              : 'ready';
    } else {
      await prisma.referralCode.create({
        data: {
          codeHmac,
          codePrefix: 'LRDE-26',
          sponsorId: sponsor.id,
          labId: labIds.get('LRDE')!,
          level: plan.level,
          intakeYear: INTAKE_YEAR,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          issuedBy: sponsorUser.id,
          issuedZone: 'internal',
        },
      });
    }
    referralRows.push({ code, level: plan.level, name: profile.name, email: profile.email, dob: profile.dob, state });
  }

  // Two spent codes, so the sponsor screen shows REVOKED and EXPIRED too.
  for (const plan of SPENT_REFERRALS) {
    const body = `${plan.payload}${checksumForBody(plan.payload)}`;
    const code = formatReferralCode('LRDE-26', body);
    const codeHmac = hmacHex(code, env.REFERRAL_HMAC_PEPPER);
    const existing = await prisma.referralCode.findUnique({ where: { codeHmac } });
    if (existing) continue;
    await prisma.referralCode.create({
      data: {
        codeHmac,
        codePrefix: 'LRDE-26',
        sponsorId: sponsor.id,
        labId: labIds.get('LRDE')!,
        level: plan.level,
        intakeYear: INTAKE_YEAR,
        expiresAt: new Date(plan.state === 'EXPIRED' ? Date.now() - 24 * 60 * 60 * 1000 : Date.now() + 365 * 24 * 60 * 60 * 1000),
        issuedBy: sponsorUser.id,
        issuedZone: 'internal',
        revokedAt: plan.state === 'REVOKED' ? new Date() : null,
        revokedReason: plan.state === 'REVOKED' ? 'Revoked by the sponsor (demo)' : null,
      },
    });
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

    // On a fresh database these are 0001-0020; a database that already ran real
    // submissions may hold some of those numbers, so fall back to a 9xxx block.
    const preferredNo = formatApplicationNo('REFERRED', INTAKE_YEAR, plan.seq);
    const numberTaken = await prisma.application.findUnique({
      where: { applicationNo: preferredNo },
      select: { id: true },
    });
    const applicationNo = numberTaken
      ? formatApplicationNo('REFERRED', INTAKE_YEAR, 9000 + plan.seq)
      : preferredNo;
    const existing = await prisma.application.findFirst({
      where: { studentId: student.id, intakeYear: INTAKE_YEAR },
    });
    if (existing) {
      // Backfill only the list-visible flag, so a re-seed still shows verified
      // letters on the cases that should have them.
      if (VERIFIED_DOC_STATUSES.includes(plan.status) && !existing.collegeLetterVerifiedAt) {
        await prisma.application.update({
          where: { id: existing.id },
          data: { collegeLetterVerifiedBy: users.ADMIN_HR?.id ?? null, collegeLetterVerifiedAt: new Date() },
        });
      }
      // Report what is actually in the database, not what this plan would create.
      seededApplications.push({
        applicationNo: existing.applicationNo ?? '(unnumbered)',
        status: existing.status,
        email: plan.email,
        dob: plan.dob,
      });
      continue;
    }

    const submitted = !['IN_PROGRESS', 'INVITED'].includes(plan.status);
    const decided = DECIDED_STATUSES.includes(plan.status);
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
        // Training that is over sits in the past; everything ahead of it keeps
        // dates in the future so the hourly no-show sweep leaves the demo alone.
        startDate: TRAINING_STATUSES.includes(plan.status) ? daysFromNow(-120) : daysFromNow(30),
        endDate: TRAINING_STATUSES.includes(plan.status) ? daysFromNow(-20) : daysFromNow(30 + 16 * 7),
        topic: plan.topic,
        synopsis: plan.synopsis,
        status: plan.status,
        revision: submitted ? 1 : 0,
        intakeYear: INTAKE_YEAR,
        submittedAt: submitted ? new Date() : null,
        lastEditedAt: new Date(),
        directorateId: DIRECTORATE_STATUSES.includes(plan.status) ? (directorateIds.get('AVIONICS') ?? null) : null,
        committeeBatchId: ['COMMITTEE_REVIEW', 'DIRECTOR_DECISION'].includes(plan.status) ? COMMITTEE_BATCH : null,
        decisionAt: decided ? new Date() : null,
        decisionBy: decided ? users.DIRECTOR!.id : null,
        collegeLetterVerifiedBy: VERIFIED_DOC_STATUSES.includes(plan.status) ? users.ADMIN_HR?.id : null,
        collegeLetterVerifiedAt: VERIFIED_DOC_STATUSES.includes(plan.status) ? new Date() : null,
        rejectionReasonCode: plan.rejectionReasonCode ?? null,
        withdrawnAt: plan.status === 'WITHDRAWN' ? new Date() : null,
        cancellationReason: plan.status === 'CANCELLED' ? 'Candidate did not report on the reporting date' : null,
      },
    });

    if (DIRECTORATE_STATUSES.includes(plan.status)) {
      await prisma.directorateAssignment.create({
        data: {
          applicationId: application.id,
          directorateId: directorateIds.get('AVIONICS')!,
          guideId: users.GUIDE?.id ?? null,
          assignedBy: users.ADMIN_HR!.id,
        },
      });
    }

    if (REVIEWED_STATUSES.includes(plan.status)) {
      await prisma.review.create({
        data: {
          applicationId: application.id,
          committeeMemberId: users.COMMITTEE!.id,
          score: 8.2,
          remarks: 'Recommended by the seeded committee review',
          recommendation: plan.status === 'NOT_RECOMMENDED' ? 'NOT_RECOMMEND' : 'RECOMMEND',
          submittedAt: new Date(),
        },
      });
    }

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

      const verified = VERIFIED_DOC_STATUSES.includes(plan.status);
      await prisma.document.create({
        data: {
          applicationId: application.id,
          kind: 'COLLEGE_LETTER',
          version: 1,
          fileId: file.id,
          sha256: file.sha256,
          verifiedBy: verified ? users.ADMIN_HR?.id : null,
          verifiedAt: verified ? new Date() : null,
        },
      });
    }

    if (OFFER_STATUSES.includes(plan.status)) {
      await prisma.offer.create({
        data: {
          applicationId: application.id,
          guideId: users.GUIDE?.id ?? null,
          issuedAt: new Date(),
          // OFFER_ISSUED and ACCEPTED are the statuses the no-show sweep cancels
          // once the reporting date passes, so their date must stay ahead of today.
          reportingDate:
            plan.status === 'ACCEPTED'
              ? daysFromNow(14)
              : plan.status === 'OFFER_ISSUED'
                ? daysFromNow(21)
                : daysFromNow(-30),
          acceptedAt: ACCEPTED_STATUSES.includes(plan.status) ? daysFromNow(-10) : null,
        },
      });
    }

    if (PASS_STATUSES.includes(plan.status)) {
      await prisma.joining.create({
        data: {
          applicationId: application.id,
          passNo: `ADA/PASS/2026/${String(plan.seq).padStart(4, '0')}`,
          passIssuedAt: new Date(),
          verifiedBy: users.SECURITY?.id ?? null,
          verifiedAt: new Date(),
        },
      });
    }

    if (TRAINING_STATUSES.includes(plan.status)) {
      for (const month of ['2026-01', '2026-02']) {
        await prisma.attendance.create({
          data: { applicationId: application.id, month, presentDays: 21, totalDays: 22, enteredBy: users.GUIDE?.id ?? null },
        });
      }
    }

    if (plan.status === 'CERTIFICATE_ISSUED') {
      await prisma.certificate.create({
        data: {
          applicationId: application.id,
          serialNo: `ADA/CERT/2026/${String(plan.seq).padStart(4, '0')}`,
          issuedBy: users.ADMIN_HR!.id,
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

  console.log('Student sign-in - referral codes (development only, same on every install):\n');
  console.log(`${'REFERRAL CODE'.padEnd(21)}${'LEVEL'.padEnd(7)}${'STUDENT'.padEnd(17)}${'DATE OF BIRTH'.padEnd(15)}${'STATE'.padEnd(9)}EMAIL`);
  console.log('-'.repeat(21 + 7 + 17 + 15 + 9 + 34));
  for (const row of referralRows) {
    console.log(
      `${row.code.padEnd(21)}${row.level.padEnd(7)}${row.name.padEnd(17)}${row.dob.padEnd(15)}${row.state.padEnd(9)}${row.email}`,
    );
  }
  console.log('\nEnter one of these at the public zone, then the email beside it, then the 6-digit code');
  console.log('shown on screen. The form opens with the student\'s personal and college details filled in.');
  if (referralRows.some((row) => row.state !== 'ready')) {
    console.log('A code marked USED/BOUND has already been spent: reset the demo database for a clean sign-in.');
  }
  console.log('');

  console.log('Demo applications - one for every pipeline status; the public status check needs the number and DOB:\n');
  console.log(`${'APPLICATION NO'.padEnd(24)}${'STATUS'.padEnd(24)}${'DATE OF BIRTH'.padEnd(15)}EMAIL`);
  console.log('-'.repeat(24 + 24 + 15 + 30));
  for (const row of seededApplications) {
    console.log(`${row.applicationNo.padEnd(24)}${row.status.padEnd(24)}${row.dob.padEnd(15)}${row.email}`);
  }
  console.log('');
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

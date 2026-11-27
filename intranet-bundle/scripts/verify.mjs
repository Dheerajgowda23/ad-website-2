#!/usr/bin/env node
/**
 * ADA portal - post-install verification.
 *
 * Run inside the tools container, from the bundle folder:
 *
 *   docker compose -f docker-compose.intranet.yml --profile tools run --rm -T \
 *     tools node /app/verify.mjs
 *
 *   ... add --issue-referral to also mint a fresh student code and print it,
 *   ... add --student to sign a student in end to end with one of the three
 *       seeded codes (the same codes on every install; see TESTING.md section 5).
 *
 * Nothing here writes to the portal except the optional referral. It uses only
 * node's built-in fetch, so it runs on any machine that has the image, with no
 * npm install and no internet.
 */

const PUBLIC_URL = (process.env.VERIFY_PUBLIC_URL || process.env.PUBLIC_APP_ORIGIN || 'http://localhost:4000').replace(/\/+$/, '');
const INTERNAL_URL = (process.env.VERIFY_INTERNAL_URL || process.env.INTERNAL_APP_ORIGIN || 'http://localhost:4001').replace(/\/+$/, '');
const ISSUE_REFERRAL = process.argv.includes('--issue-referral');
const STUDENT_JOURNEY = process.argv.includes('--student');
const TEST_STUDENT_EMAIL = process.env.VERIFY_STUDENT_EMAIL || 'test.student@example.edu.in';

// What `npm run db:seed` creates on a fresh database (apps/api/src/seed.ts).
const SEEDED_APP = { applicationNo: 'ADA/INT/R/2026/0001', dob: '2003-04-18' };

// Fixed student sign-in codes. Each has a student profile behind it, so the form
// opens with the personal and college fields already filled in.
const SEEDED_REFERRALS = [
  { code: 'LRDE-26-DEMU-G239', email: 'sneha.kulkarni@example.edu.in', name: 'Sneha Kulkarni', level: 'UG' },
  { code: 'LRDE-26-DEMU-G476', email: 'imran.sheikh@example.edu.in', name: 'Imran Sheikh', level: 'UG' },
  { code: 'LRDE-26-DEMP-G58D', email: 'divya.menon@example.edu.in', name: 'Divya Menon', level: 'PG' },
];

let failed = 0;

const pass = (name, detail) => console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`);
const fail = (name, detail) => {
  failed += 1;
  console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
};

const check = async (name, fn) => {
  try {
    const detail = await fn();
    pass(name, detail);
  } catch (error) {
    fail(name, error.message);
  }
};

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

/** Sponsor mints a code for the test student. Consumes one of the three per year. */
const issueReferral = async (sponsor, email) => {
  expect(sponsor, 'sponsor login failed, cannot issue a code');
  const res = await request(INTERNAL_URL, '/api/staff/referrals', {
    method: 'POST',
    cookie: sponsor.cookie,
    body: { level: 'UG', studentName: 'Test Student', studentEmail: email },
  });
  expect(res.status === 200, `HTTP ${res.status} ${res.text.slice(0, 160)}`);
  return res.json;
};

const request = async (base, path, options = {}) => {
  const { method = 'GET', body, cookie, headers = {} } = options;
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return { status: res.status, json, text, cookie: setCookies.map((value) => value.split(';')[0]).join('; ') };
};

/** Three steps, exactly as the browser does them: email -> mailbox OTP -> authenticator. */
const staffLogin = async (email) => {
  const first = await request(INTERNAL_URL, '/api/staff/auth/email/request', { method: 'POST', body: { email } });
  expect(first.status === 202, `email/request returned HTTP ${first.status}`);
  expect(first.json?.devCode, 'no devCode returned - set ALLOW_DEV_OTP=true in .env for a demo install');

  const second = await request(INTERNAL_URL, '/api/staff/auth/otp/verify', {
    method: 'POST',
    body: { challengeId: first.json.challengeId, code: first.json.devCode },
  });
  expect(second.status === 200, `otp/verify returned HTTP ${second.status}`);
  expect(second.json?.devTotpCode, 'no devTotpCode returned - set ALLOW_DEV_OTP=true in .env');

  const third = await request(INTERNAL_URL, '/api/staff/auth/totp/verify', {
    method: 'POST',
    body: { pendingId: second.json.pendingId, code: second.json.devTotpCode },
  });
  expect(third.status === 200, `totp/verify returned HTTP ${third.status} ${third.text.slice(0, 120)}`);
  expect(third.cookie, 'login succeeded but no session cookie was set');
  return { user: third.json.user, permissions: third.json.permissions ?? [], cookie: third.cookie };
};

const main = async () => {
  console.log('\nADA portal - verification');
  console.log(`  public zone   : ${PUBLIC_URL}`);
  console.log(`  internal zone : ${INTERNAL_URL}`);

  console.log('\n[1] Both zones are up');

  await check('public zone /api/health', async () => {
    const res = await request(PUBLIC_URL, '/api/health');
    expect(res.status === 200 && res.json?.ok === true, `HTTP ${res.status}`);
    expect(res.json.zone === 'public', `answered as zone=${res.json.zone}`);
    return 'zone=public';
  });

  await check('internal zone /api/health', async () => {
    const res = await request(INTERNAL_URL, '/api/health');
    expect(res.status === 200 && res.json?.ok === true, `HTTP ${res.status}`);
    expect(res.json.zone === 'internal', `answered as zone=${res.json.zone}`);
    return 'zone=internal';
  });

  console.log('\n[2] Database has the seeded rows');

  await check('seeded application answers the public status check', async () => {
    const query = `?applicationNo=${encodeURIComponent(SEEDED_APP.applicationNo)}&dob=${SEEDED_APP.dob}`;
    const res = await request(PUBLIC_URL, `/api/public/info/status-check${query}`);
    expect(res.status === 200, `HTTP ${res.status} ${res.text.slice(0, 160)}`);
    const body = res.json ?? {};
    const status = body.status ?? body.application?.status ?? body.result?.status ?? 'found';
    return `${SEEDED_APP.applicationNo} -> ${status}`;
  });

  await check('public guidelines page data loads', async () => {
    const res = await request(PUBLIC_URL, '/api/public/info/guidelines');
    expect(res.status === 200, `HTTP ${res.status}`);
    return 'ok';
  });

  await check('no public session means 401 on the application form', async () => {
    const res = await request(PUBLIC_URL, '/api/public/application');
    expect(res.status === 401, `HTTP ${res.status}`);
    return '401';
  });

  await check('a made-up referral code is refused', async () => {
    const res = await request(PUBLIC_URL, '/api/public/auth/redeem', {
      method: 'POST',
      body: { code: 'LRDE-26-2222-2222' },
    });
    expect(res.status === 401, `expected 401, got HTTP ${res.status}`);
    return `401 ${res.json?.error?.code ?? ''}`.trim();
  });

  console.log('\n[3] Staff sign-in (all three steps) and role gate');

  let admin;
  await check('ADMIN_HR signs in and becomes an ADMIN_HR session', async () => {
    admin = await staffLogin('admin.hr@ada.gov.in');
    expect(admin.user?.role === 'ADMIN_HR', `role=${admin.user?.role}`);
    return `${admin.user.name}, ${admin.permissions.length} permissions`;
  });

  await check('ADMIN_HR can list the seven seeded staff accounts', async () => {
    expect(admin, 'login failed, nothing to test');
    const res = await request(INTERNAL_URL, '/api/staff/users', { cookie: admin.cookie });
    expect(res.status === 200, `HTTP ${res.status}`);
    const users = res.json?.users ?? [];
    expect(users.length >= 7, `only ${users.length} staff rows`);
    return `${users.length} staff accounts`;
  });

  await check('configuration screen returns the feature flags', async () => {
    expect(admin, 'login failed, nothing to test');
    const res = await request(INTERNAL_URL, '/api/staff/config', { cookie: admin.cookie });
    expect(res.status === 200, `HTTP ${res.status}`);
    const flags = res.json?.flags ?? [];
    expect(flags.length >= 6, `only ${flags.length} flags`);
    return `${flags.length} flags, ${res.json?.settings?.seatsUg ?? '?'} UG seats`;
  });

  await check('no session means 401 on /api/staff/me', async () => {
    const res = await request(INTERNAL_URL, '/api/staff/me');
    expect(res.status === 401, `HTTP ${res.status}`);
    return '401';
  });

  await check('a foreign Origin is refused (CSRF guard)', async () => {
    const res = await request(INTERNAL_URL, '/api/staff/auth/logout', {
      method: 'POST',
      headers: { origin: 'http://attacker.example' },
    });
    expect(res.status === 403, `HTTP ${res.status}`);
    expect(res.json?.error?.code === 'FOREIGN_ORIGIN', `code=${res.json?.error?.code}`);
    return '403 FOREIGN_ORIGIN';
  });

  await check('SECURITY role is refused the user-admin screen', async () => {
    const security = await staffLogin('security@ada.gov.in');
    const res = await request(INTERNAL_URL, '/api/staff/users', { cookie: security.cookie });
    expect(res.status === 403, `expected 403, got HTTP ${res.status}`);
    return '403 PERMISSION_DENIED';
  });

  console.log('\n[4] Sponsor referral stock');

  let sponsor;
  await check('SPONSOR signs in and can read their own codes', async () => {
    sponsor = await staffLogin('sponsor.lrde@ada.gov.in');
    expect(sponsor.user?.role === 'SPONSOR', `role=${sponsor.user?.role}`);
    const res = await request(INTERNAL_URL, '/api/staff/referrals/my', { cookie: sponsor.cookie });
    expect(res.status === 200, `HTTP ${res.status}`);
    const codes = res.json?.referrals ?? res.json?.codes ?? res.json ?? [];
    const count = Array.isArray(codes) ? codes.length : 0;
    expect(count >= 1, 'no referral codes on file - run npm run db:seed');
    return `${count} codes on file`;
  });

  if (ISSUE_REFERRAL) {
    console.log('\n[5] Issue one fresh referral code for a test student');
    await check('sponsor issues a UG referral', async () => {
      const issued = await issueReferral(sponsor, TEST_STUDENT_EMAIL);
      console.log(`\n  Referral code : ${issued.code}`);
      console.log(`  Valid until   : ${new Date(issued.expiresAt).toISOString().slice(0, 10)}`);
      console.log(`  Remaining     : ${issued.quotaRemaining} of 3 this year`);
      console.log(`\n  Use it at ${process.env.PUBLIC_APP_ORIGIN || PUBLIC_URL}: enter the code,`);
      console.log(`  then ${TEST_STUDENT_EMAIL}, then the 6-digit code shown on screen.\n`);
      return 'printed above';
    });
  }

  if (STUDENT_JOURNEY) {
    console.log('\n[6] Student journey on the public zone');
    let code = '';
    let studentEmail = '';
    let studentName = '';
    let referralToken = '';
    let studentCookie = '';

    await check('a seeded student code is accepted and names the sponsor', async () => {
      const refused = [];
      for (const candidate of SEEDED_REFERRALS) {
        const res = await request(PUBLIC_URL, '/api/public/auth/redeem', { method: 'POST', body: { code: candidate.code } });
        if (res.status === 200 && res.json?.referralToken) {
          code = candidate.code;
          studentEmail = candidate.email;
          studentName = candidate.name;
          referralToken = res.json.referralToken;
          const preview = res.json.referral ?? {};
          return `${code} (${preview.labCode} ${preview.level}), sponsored by ${preview.sponsorName}`;
        }
        refused.push(`${candidate.code} -> HTTP ${res.status}`);
      }
      throw new Error(`no seeded code is usable (${refused.join(', ')}); reset the demo database, TESTING.md section 9`);
    });

    await check('the student verifies the mailbox code and gets a session', async () => {
      expect(referralToken, 'no code was accepted, nothing to test');
      const first = await request(PUBLIC_URL, '/api/public/auth/otp/request', {
        method: 'POST',
        body: { referralToken, email: studentEmail },
      });
      expect(first.status === 202, `otp/request HTTP ${first.status} ${first.text.slice(0, 120)}`);
      expect(first.json?.devCode, 'no devCode returned - set ALLOW_DEV_OTP=true in .env');

      const second = await request(PUBLIC_URL, '/api/public/auth/otp/verify', {
        method: 'POST',
        body: { challengeId: first.json.challengeId, code: first.json.devCode },
      });
      expect(second.status === 200, `otp/verify HTTP ${second.status} ${second.text.slice(0, 120)}`);
      expect(second.cookie, 'signed in but no student session cookie was set');
      studentCookie = second.cookie;
      return second.json?.resumed ? 'resumed an existing application' : 'new application created';
    });

    await check('the form opens with the seeded student profile filled in', async () => {
      expect(studentCookie, 'login failed, nothing to test');
      const res = await request(PUBLIC_URL, '/api/public/application', { cookie: studentCookie });
      expect(res.status === 200, `HTTP ${res.status}`);
      const application = res.json?.application;
      expect(application, 'no application in the response');
      expect(application.student?.fullName === studentName, `fullName=${application.student?.fullName}, expected ${studentName}`);
      expect(application.student?.collegeName, 'college name is blank - the seeded profile was not used');
      return `${application.student.fullName}, ${application.student.collegeName}, ${application.status}, editable=${application.editable}`;
    });

    await check('the same code cannot be redeemed a second time', async () => {
      expect(code, 'no code was accepted, nothing to test');
      const res = await request(PUBLIC_URL, '/api/public/auth/redeem', { method: 'POST', body: { code } });
      expect(res.status === 401, `expected 401, got HTTP ${res.status}`);
      expect(res.json?.error?.code === 'INVALID_CODE', `code=${res.json?.error?.code}`);
      return '401 INVALID_CODE';
    });
  }

  const total = failed === 0 ? 'all checks passed' : `${failed} check(s) FAILED`;
  console.log(`\nResult: ${total}`);
  if (failed === 0) {
    // The browser-facing origins from .env, not the container names used above.
    console.log(`  Students / other labs : ${process.env.PUBLIC_APP_ORIGIN || PUBLIC_URL}`);
    console.log(`  ADA staff             : ${process.env.INTERNAL_APP_ORIGIN || INTERNAL_URL}`);
  } else {
    console.log('  Next: docker compose -f docker-compose.intranet.yml logs --tail=60');
    console.log('        docker compose -f docker-compose.intranet.yml ps');
  }
  console.log('');
  process.exitCode = failed === 0 ? 0 : 1;
};

main().catch((error) => {
  console.error(`\nVerification could not run: ${error.message}`);
  process.exitCode = 1;
});

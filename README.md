# ADA Internship & Project Work Portal

Internship and project-work intake for the **Aeronautical Development Agency**, Bengaluru (a DRDO
lab). One pipeline, one codebase, one database — split across an internet zone and an air-gapped
intranet zone.

This repository covers **M0–M6**: the runnable skeleton, Prisma schema and migrations, the
zone-split login (M2), the referral → application → screening → seat → reporting → certificate
pipeline (M3–M5), and PDF documents, notifications, feature flags and CSV export (M6). See the
CODE-HANDOFF contract for the milestone list.

```
apps/api            Express 5 + TypeScript, ZONE=public|internal, Prisma 6
apps/web-public     React 19 + Vite build for the internet (port 5173)
apps/web-internal   React 19 + Vite build for the intranet (port 5174)
packages/shared     Zod schemas, roles, permissions, state machine, code format
db/                 grants for the two Postgres roles
prisma              schema + first migration (apps/api/prisma)
```

## Run it

Everything in containers:

```bash
cp .env.example .env      # development values only
docker compose up -d      # db + migrate (one-shot) + both API zones
```

That gives `:4000` (public) and `:4001` (internal) from the **same image**, so the only difference
between the two services is `ZONE` and the Postgres role they connect as. Seed once with the owner
credentials, then run the two web builds on the host:

```bash
npm install
npm run db:seed           # prints one account per role and the referral codes
npm run dev:public        # :5173  internet zone
npm run dev:internal      # :5174  intranet zone
```

Running the API on the host instead of in containers:

```bash
npm run db:generate && npm run db:migrate
npm run dev:api:public    # :4000  ZONE=public   -> /api/public/* only
npm run dev:api:internal  # :4001  ZONE=internal -> /api/staff/* only
```

Notes on the compose stack:

- Containers reach Postgres at `db:5432`; the host uses `localhost:5433`. `docker-compose.yml`
  derives the in-container URLs from the service name, so the `localhost` URLs in `.env` are for
  host tools and tests only.
- `migrate` runs `prisma migrate deploy` as `portal_owner` and exits; both APIs wait for it. Schema
  changes never run as a zone role.
- The image installs `openssl`, without which Prisma cannot pick its query engine on a slim base.

## Tests

```bash
docker compose up -d db   # required: the login-flow tests use a real Postgres
npm test
```

`tests/pg/login-flow.test.ts` drives referral redemption, email OTP and TOTP against the real
Express app as the real runtime roles (`portal_public`, `portal_internal`), including a real
`session_public` / `session_staff` row. A missing table grant fails an assertion there instead of
surfacing as a 500 in the portal — revoke `SELECT ON sponsors FROM portal_public` and four tests go
red. The other suites stay hermetic (no database needed).

## The zone split, and how to check it

Two builds, two route trees, two processes off one image. `ZONE` decides which router is mounted:

| | Public | Internal |
|---|---|---|
| API process | `ZONE=public` :4000 | `ZONE=internal` :4001 |
| Mounted router | `/api/public/*` | `/api/staff/*` |
| DB role | `portal_public` | `portal_internal` |
| Session cookie | `ada.pub.sid`, table `session_public` | `ada.int.sid`, table `session_staff` |
| Users | students | ADA staff |

```bash
# An internal session cookie on the public host is 404 — the route does not exist.
curl -i http://localhost:4000/api/staff/config -H 'Cookie: ada.int.sid=<valid internal session>'
# HTTP/1.1 404 Not Found   {"error":{"code":"NOT_FOUND"},...}
```

The test suite asserts exactly that, using one shared session store so the internal cookie is
genuinely valid: `apps/api/tests/zone-split.test.ts`.

Sessions also carry the zone they were issued in, and a session whose claim disagrees with the
process is destroyed on arrival (`zoneClaimGuard`).

## Roles and permissions

One login page per zone; the account determines the role. No role dropdown, no role in any
payload — `requireStaff` loads the user row and `requirePermission` checks the matrix in
`packages/shared/src/permissions.ts`.

| Role | Zone | Permissions |
|---|---|---|
| `STUDENT` | public | application:read:own, application:edit:own, application:withdraw:own, document:upload:own, document:read:own, offer:respond:own |
| `SPONSOR` | internal | referral:create, referral:read:own, referral:revoke:own, trainee:read |
| `GUIDE` | internal | trainee:read, attendance:write, clearance:write |
| `DIRECTORATE_HEAD` | internal | directorate:read, directorate:confirm, topic:approve, seat:read, trainee:read |
| `ADMIN_HR` | internal | screening:read, screening:write, college_letter:verify, application:assign, application:return, application:reject, seat:read, seat:write, letter:issue, export:run, reporting:read, certificate:issue, user:manage, flag:manage, audit:read, committee:read, decision:read, config:read, config:write, referral:read:own |
| `COMMITTEE` | internal | committee:read, committee:score |
| `DIRECTOR` | internal | screening:read, seat:read, committee:read, decision:read, decision:approve, capacity:override, audit:read, certificate:issue, config:read |
| `SECURITY` | internal | security:queue:read, pass:issue, document:verify |

`ADMIN_HR` is deliberately one role: casework and configuration on one dashboard. `DIRECTOR` is a
separate person with the approve/reject power and read-only access elsewhere.

A `COMMITTEE` account gets **403** on `/api/staff/config` because it holds neither `config:read`
nor `config:write` — `apps/api/tests/rbac.test.ts`. The same test sends `role: "ADMIN_HR"` in the
body and still gets 403.

## Seeded accounts

`npm run db:seed` prints the table below, with a deterministic TOTP secret per account (derived
from the email — a development convenience, never how a real secret is made) and three unused
`LRDE-26-…` referral codes, shown once.

| Role | Email |
|---|---|
| ADMIN_HR | admin.hr@ada.gov.in |
| DIRECTOR | director@ada.gov.in |
| COMMITTEE | committee@ada.gov.in |
| SECURITY | security@ada.gov.in |
| GUIDE | guide@ada.gov.in |
| DIRECTORATE_HEAD | dh.lrde@ada.gov.in |
| SPONSOR | sponsor.lrde@ada.gov.in |

Students have no account: they redeem a referral code with their own email.

`ALLOW_DEV_OTP=true` (development only, refused when `PORTAL_ENV=production`) returns the freshly
minted OTP and the current TOTP code in the API response so both login screens are demonstrable
without a mail server or an authenticator app. The screens show them in a dashed "development
code" box. `npm run totp -w @ada/api -- admin.hr@ada.gov.in` prints a code from the database.

## Login flows

**Staff (intranet).** ADA email → six-digit OTP to that mailbox → TOTP from the enrolled
authenticator. A new session id is minted at the end. No password exists, and the LDAP/AD seam is
left open rather than built.

**Student (public).** Referral code → preview of who referred them → email OTP → the code is
bound to the first verified email in a single transaction and an application is created in
`IN_PROGRESS`. The public session is scoped to that one application.

## Rules carried by the schema

- Only `aadhaar_last4` plus a keyed `aadhaar_ref_hash`; no full Aadhaar anywhere (`maskAadhaar`).
- No college account, no college login, no college email — the college letter is a scanned upload.
- `application_revisions` is append-only; `applications.revision` is the optimistic guard.
- Soft deletes (`deleted_at`) on every table that could otherwise be destroyed.
- `audit_log` on every transition: login success/failure, referral redemption, application
  creation, permission denial, flag change — with actor, role, IP, before/after, reason.
- `zone_events` records zone mismatches, foreign origins and permission denials.
- Referral codes are stored as HMAC-SHA256 with a server-side pepper; one generic error for
  invalid, expired, used and revoked.
- Application numbers are `ADA/INT/R|O|P/<year>/<0001>` from the `application_no_seq` sequence,
  allocated inside the submission transaction (M3+).

## Not in this milestone

Uploads are stored as document metadata rows only — MinIO/ClamAV object storage and virus
scanning are not wired yet, so the scan itself must be added before go-live. Also out of scope:
background jobs, LDAP, row-level security policies, Playwright end-to-end flows, fingerprint
attendance devices, and the post-project backlog from the handoff (SMS, bilingual UI, analytics,
plagiarism checks).

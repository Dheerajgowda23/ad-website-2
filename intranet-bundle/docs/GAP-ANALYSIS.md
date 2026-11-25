# Gap analysis — portal vs. the CODE-HANDOFF contract

Audited 24 Nov 2026 against `.cloud-attachments/` (the CODE-HANDOFF contract, §1–§15),
the Prisma schema, the API route trees, both React builds and the test suite.

The repository implements **M0–M6**. This document separates three things:

1. what was missing and has now been **added** in this pass,
2. what is still **missing or partial**, with the milestone/priority it belongs to,
3. what is **deliberately out of scope** (contract §13) and must not be mistaken for a defect.

---

## 1. Added in this pass

### 1.1 Added 25 Nov 2026

| Gap | Why it mattered | What was built |
|---|---|---|
| **A single committee member decided the whole packet** | `submitCommitteeReview` advanced the application on the first review, so "committee" was one person with a score box. Contract §6 M6 requires a quorum rule. | `COMMITTEE_QUORUM` (default 2, capped by the members actually assigned to the batch) gates the transition; every review is audited with `reviewsReceived`/`quorum`, and any `NOT_RECOMMEND` stops the packet. |
| **A sponsor could review their own referral** | Contract §6 M2 excludes the sponsoring employee from any committee review of their own referral; nothing enforced it. | `CONFLICT_OF_INTEREST` 403 before the review is written. |
| **NO_SHOW never happened** | Contract §5/§11.4: an offer whose reporting date passes is cancelled automatically — the biggest reporting-day failure point. No scheduler existed, so those applications sat in `ACCEPTED` forever. | `sweepNoShows()` runs hourly in the internal zone (and on boot), cancels with `cancellationReason = NO_SHOW…`, writes `SYSTEM_NO_SHOW_CANCELLED` to the audit log and queues the student notification. `POST /casework/maintenance/sweep-no-shows` triggers it by hand. |
| **No sponsor verification queue** | Contract §6 M11: a sponsor from another DRDO lab must be verified by Admin & HR before their codes work. `PENDING` existed in the schema but nothing set it, listed it, or enforced it. | `POST /api/staff/users` accepts a `labId` for the `SPONSOR` role, creates the sponsor profile `PENDING` for a non-ADA lab (work email allowed, ADA addresses still enforced), and `GET /api/staff/users/sponsors` + `POST /api/staff/users/sponsors/:id/verify` drive a new **Sponsors** tab. Redemption refuses an unverified sponsor's code with the same generic `INVALID_CODE`, so the queue leaks nothing. |
| **Documents were stored in the clear** | Contract §7 and `AGENTS.md`: the Aadhaar scan must be encrypted at rest. The volume held readable PDFs. | AES-256-GCM at rest (`FILE_ENCRYPTION_KEY`, falling back to `SESSION_SECRET`); new files carry an `ADAENC1` header, pre-existing plaintext files still read. A test asserts the PDF header is not present in the bytes on disk and that the download round-trips. |
| **`scan_status = CLEAN` with no scanner** | A file nobody had inspected was labelled clean. | Uploads and seed data now record `PENDING`; the schema default already matched. |

### 1.2 Added 24 Nov 2026

| Gap | Why it mattered | What was built |
|---|---|---|
| No production web hosting | Both UIs only ran on Vite dev servers on the host — unusable on an air-gapped PC, and cross-origin cookies made sign-in fragile | The API image now builds both SPAs and each zone serves its own UI from the same origin (`WEB_DIST`, SPA fallback, `index.html` no-store, hashed assets immutable) |
| Email was mocked | `notification.service` marked rows SENT with `mock-email-*`, and OTPs were only ever echoed in dev. In production mode nobody could sign in | `lib/mailer.ts` with nodemailer over an internal SMTP relay; OTP mail per purpose; production returns `503 EMAIL_UNAVAILABLE` instead of pretending to send; queued notifications dispatch every 60 s and are marked FAILED with the provider error, not SENT |
| Production cookie flag | `secure: true` whenever `PORTAL_ENV=production` meant a plain-HTTP intranet install could never keep a session | `COOKIE_SECURE` override (default: production), documented in `.env.example` and the guide |
| No offline deliverable | Images, compose file, grants, secrets and instructions had to be assembled by hand | `intranet-bundle/` with `docker-compose.intranet.yml`, preloaded image tarballs, install/start/stop/status/logs/backup/restore scripts for Linux/macOS and PowerShell, `SHA256SUMS.txt`, install guide as PDF/DOCX/Markdown |
| No backup/restore procedure | Handoff §10 M7 requires a demonstrated restore | `scripts/backup.{sh,ps1}` (pg_dump custom format + `.env`) and `scripts/restore.{sh,ps1}` with an explicit confirmation prompt |
| TOTP enrolment was seed-only | Seeded secrets derive from the email address; no way to enrol a real person's phone | `npm run totp:enroll -w @ada/api -- <email> [--qr file.png]` — prints QR/otpauth URI, rotates the secret, writes an audit row |
| Notification dispatcher never ran | `processQueuedNotifications` had no caller: rows accumulated as QUEUED forever | Called once at boot and on a 60 s interval when `SMTP_HOST` is set |
| **Documents were rows, not files** | The API accepted a base64 upload, stored metadata, and reported `CLEAN` — nothing was written anywhere, and staff had no way to open a college letter | Files are written to a mounted volume (`FILE_STORAGE_DIR`) under a content-hashed, immutable key; student download (own application only) and staff download (`screening:read`, audited) return `attachment` with `nosniff`; 10 MB cap; empty-file rejection; tests assert the bytes exist and that another session gets 401 |
| **First sign-in dead-ended unenrolled accounts** | `TOTP_NOT_ENROLLED` 403 with "ask Admin & HR" — and no way to enrol except a CLI | After the email code, an account without an authenticator gets a QR + secret in the signed pending token and enrols by proving one code; `POST /api/staff/auth/totp/enrol`; audit row; UI screen |
| **No attendance report** | Guide-level entry existed; nothing aggregated it and nothing exported it | `GET /casework/attendance/report?month=YYYY-MM` (reporting:read) + `export.csv` (export:run), a dashboard tab with month picker, and CSV escaping tested |
| **zone_events were write-only** | Mismatches, foreign origins and rejected zone claims were recorded but never raised | `alert.service.ts`: 15-minute window, deduplicated, mails every active ADMIN_HR when SMTP is configured; runs at boot and every 5 minutes |
| Public site had 5 of 6 screens | Contract §8 asks for FAQ and downloads | `/faq` and `/downloads` pages plus navigation; downloads links the live Annexure II PDF rather than a stale copy |
| **No staff administration** | `user:manage` existed with no route behind it: creating an officer, disabling a leaver or replacing a lost phone all needed SQL and the CLI | `GET/POST /api/staff/users`, `PATCH /api/staff/users/:id`, `POST /api/staff/users/:id/reset-authenticator`; roles are validated, non-ADA addresses refused, the last active ADMIN & HR cannot be locked out, self-deactivation refused, every change audited, and a "Staff & Access" dashboard tab does the same work without SQL |
| **No bulk casework** | Returning, rejecting or chasing 40 applications one at a time was the only way | `POST /casework/applications/bulk` (RETURN / REJECT / REMIND) with per-row results, existing per-action permissions, correction emails and a sponsor reminder template; selection checkboxes in the inbox |
| **Attendance could only be typed per trainee** | A guide with 20 trainees entered 20 forms a month | `POST /casework/attendance/import` parses `applicationNo,month,presentDays,totalDays`, validates each row against the same schema, imports up to 500 rows and reports every rejected line without aborting the batch |

Verification for this pass: both web builds, workspace typecheck, the existing suite
(23 tests), and a cold start of the bundle stack with images loaded from tarballs.

---

## 2. Still missing or partial

Ordered by what blocks a real go-live. "Contract" refers to CODE-HANDOFF sections.

### 2.1 Blocking for real use

| # | Gap | Contract | Detail / what is needed |
|---|---|---|---|
| 1 | **No virus scanning / quarantine** | §1.9, §3, §9 | Files are stored encrypted at rest, versioned, hashed and downloadable (local volume; see section 1), but there is no ClamAV, no quarantine state machine and no signed short-lived links — access is by an authenticated, permission-checked route, and `scan_status` stays `PENDING`. Add a scanner sidecar and a PENDING → CLEAN/INFECTED transition before accepting uploads from outside ADA. |
| 2 | **No M7 hardening** | §10 M7 | Quarantine + scan (ties to 2.1), WAF rules, alerting on zone mismatch. `zone_events` records mismatches, foreign origins and permission denials, but nothing raises an alert: no mail to Admin & HR, no threshold, no dashboard count. A restore rehearsal is now scripted but has not been performed against production data. |
| 3 | **RLS not enabled** | §1.6, §9 | Two least-privilege Postgres roles and explicit table grants exist; row-level security policies do not. Today isolation between, say, two directorates rests on application code. Needed before multi-tenant or delegated administration. |
| 4 | **Public "other DRDO lab" sponsor path** | §2, §3 | Other-lab sponsors can now be created with their own work email and lab, and their codes stay inert until Admin & HR verify them (section 1.1). Still missing: a *public* sponsor login for other labs — `SPONSOR` remains internal-only in `ROLE_ZONE`, so a nodal officer must create the account. Either build the public sponsor portal or record the decision that other labs work through an ADA-created account for v1. |
| 5 | **Background jobs** | §9 | `pg-boss` was the chosen job runner; notification delivery is an in-process interval instead. That is fine for one container per zone but duplicates sends if you ever scale horizontally, and gives no retry/backoff. |

### 2.2 Incomplete screens / flows

| # | Gap | Contract | Detail |
|---|---|---|---|
| 6 | Remaining downloads are thin | §8 | FAQ and downloads now exist. The downloads page links guidelines, the blank Annexure II and the portal-generated documents; there is still no hosted copy of Annexure I, the undertaking format, the application format or the certificate format. |
| 7 | Reporting-day checklist is not a printable screen | §8 | Attendance CSV import and the printable checklist remain the two gaps here: the checklist exists as packet data, not as a sheet Security can tick at the desk. |
| 10 | Committee packet presentation is thin | §8 | Scoring exists; the "packet with revisions, verified-letter stamp, committee scores, decision buttons with reason" is assembled from list/detail data rather than a single printable packet. Earlier-revision diff is not shown in the UI. |
| 11 | Print packet missing | §8 | Bulk reject / remind / return are implemented; a print-formatted committee packet is not. |
| 12 | No config screen for reason codes/templates | §8, §12 | Flags, intake year and capacity are editable; reason codes, letter templates, `return_for_correction_days` and `edit_cap_per_day` are not exposed in configuration. The open decisions in §12 are unimplemented by design. |

### 2.3 Engineering / quality

| # | Gap | Detail |
|---|---|---|
| 13 | No end-to-end tests | Contract §9 asks for Playwright on two critical flows. All tests are API-level (Vitest + Supertest, 23 tests incl. Postgres-backed login and workflow lifecycle). A browser test would catch the kind of breakage static serving introduces. |
| 14 | No CI/CD | Contract §13 allows "no CI/CD beyond a build script". There is no build script that produces this bundle from a clean checkout other than `scripts/build-intranet-bundle.sh` (added). |
| 15 | LDAP/AD | Deliberately a seam, not built (§2). Email OTP + TOTP is v1. |
| 16 | Language/i18n, SMS, payments, eSign, mobile app, analytics | Out of scope (§13). |

---

## 3. Deliberately not built (do not treat as bugs)

- Open application channel (`entry_channel = OPEN` exists, disabled by policy).
- College accounts, college login, college email, signed college links.
- Stipend, fees, payments, eSign, SMS, mobile app, chat, translations, public API.
- Aadhaar API integration — only last-4 plus a keyed hash is stored.
- Splitting `ADMIN_HR` into Admin and HR (explicitly forbidden).

---

## 4. Suggested next milestone

**M7 — hardening and evidence**, in this order:

1. Uploads: quarantine directory, ClamAV scan service in compose, MinIO (or a mounted
   volume for offline installs), signed download links, document panel in the packet.
2. Alerting: a `zone_events` reader that mails ADMIN_HR on `ZONE_MISMATCH`,
   `FOREIGN_ORIGIN` bursts and repeated `PERMISSION_DENIED`.
3. RLS migration for `applications`, `students`, `documents`, `reviews`.
4. Playwright: student redeem → submit → edit-lock, and Admin & HR screen → decision.
5. Rehearsed restore on the intranet host, recorded in the operations log.

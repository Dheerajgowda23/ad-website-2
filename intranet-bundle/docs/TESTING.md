# ADA Portal - Testing on the Intranet PC

Everything here assumes you are in the bundle folder (the one with `docker-compose.intranet.yml`,
`images\`, `scripts\` and `README.txt`) on the intranet PC, after `install.ps1` / `install.sh` has
finished. No internet, no source code, no npm - only Docker.

Version 1.0.0. Last verified against image `ada-portal-api:1.0.0`.

---

## 1. Is it running?

```
docker compose -f docker-compose.intranet.yml ps
```

You must see four services. `ada-db`, `ada-api-public` and `ada-api-internal` say `(healthy)`;
`ada-migrate` says `Exited (0)` - that is correct, it is a one-shot job.

```
NAME                STATUS
ada-db              Up (healthy)
ada-api-public      Up (healthy)
ada-api-internal    Up (healthy)
ada-migrate         Exited (0)
```

Both zones answer:

```
curl http://localhost:4000/api/health      ->  {"ok":true,"zone":"public"}
curl http://localhost:4001/api/health      ->  {"ok":true,"zone":"internal"}
```

Windows PowerShell 5.1 does not ship `curl.exe` aliases for this use; use
`Invoke-RestMethod http://localhost:4000/api/health` instead.

---

## 2. The one-command test

```
docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools node /app/verify.mjs
```

(Windows PowerShell: the same line. It runs inside the API image, so it needs nothing else.)

Expected output:

```
ADA portal - verification
  public zone   : http://api-public:4000
  internal zone : http://api-internal:4001

[1] Both zones are up
  PASS  public zone /api/health  (zone=public)
  PASS  internal zone /api/health  (zone=internal)
[2] Database has the seeded rows
  PASS  seeded application answers the public status check  (ADA/INT/R/2026/0001 -> SUBMITTED)
  PASS  public guidelines page data loads  (ok)
[3] Staff sign-in (all three steps) and role gate
  PASS  ADMIN_HR signs in and becomes an ADMIN_HR session  (Meera Raghavan, 20 permissions)
  PASS  ADMIN_HR can list the seven seeded staff accounts  (7 staff accounts)
  PASS  configuration screen returns the feature flags  (6 flags, 50 UG seats)
  PASS  no session means 401 on /api/staff/me  (401)
  PASS  a foreign Origin is refused (CSRF guard)  (403 FOREIGN_ORIGIN)
  PASS  SECURITY role is refused the user-admin screen  (403 PERMISSION_DENIED)
[4] Sponsor referral stock
  PASS  SPONSOR signs in and can read their own codes  (3 codes on file)

Result: all checks passed
```

`Result: all checks passed` and exit code 0 is the go/no-go line. Any `FAIL` prints the HTTP status
and a hint; run `docker compose -f docker-compose.intranet.yml logs --tail=80` next.

What the checks prove, one by one:

| Check | Proves |
| --- | --- |
| both `/api/health` | the two containers are up, each mounting only its own zone |
| status check | the database has the seeded student/application rows and the public flag is on |
| guidelines | the public zone serves the policy notice |
| ADMIN_HR login | the full three-step sign-in works: email OTP, then TOTP, then session |
| seven staff rows | the seed created every role |
| feature flags | the config screen reads from the database |
| `401` on `/api/staff/me` | the intranet is not readable without a session |
| `403 FOREIGN_ORIGIN` | cross-site POSTs are refused |
| SECURITY `403` | a role without `user:manage` cannot reach user admin |

Note: the sign-in steps are rate limited (5 codes per 10 minutes per source IP). Running the script
four times in a row will start returning `RATE_LIMITED`; wait ten minutes or restart the API
containers.

---

## 3. Test accounts

All seven are created by `npm run db:seed`, which `install.ps1` / `install.sh` runs by default. Sign
in at **http://localhost:4001** with email -> the 6-digit mailbox code shown on screen -> the 6-digit
authenticator code shown on screen (the demo sets `ALLOW_DEV_OTP=true`, so no mail server and no
phone app are needed).

The TOTP secrets below are derived from the email address, so they are the **same on every install**.
You can load them into Google Authenticator / Microsoft Authenticator as a manual entry (time-based,
6 digits) and sign in without the on-screen hint.

| Role | Email | Employee code | TOTP secret (base32) |
| --- | --- | --- | --- |
| ADMIN_HR | `admin.hr@ada.gov.in` | ADA-1001 | `M3XBWA3HB5HLZ5UW3J4PAZUNLKIZHUXE` |
| DIRECTOR | `director@ada.gov.in` | ADA-1002 | `77QB77BYP6BRS6OI7PNMQGRUCUUBDG2E` |
| COMMITTEE | `committee@ada.gov.in` | ADA-2001 | `YP2RC4YZOXEKK4Y66TZOUMFIZDZJBUBR` |
| SECURITY | `security@ada.gov.in` | ADA-3001 | `T5RU4PGFJB7DVUF46Z4CLWPAUEUUXN3R` |
| GUIDE | `guide@ada.gov.in` | ADA-2002 | `IU3F24RB5Q4K4GGMFNCBG2DTNBXNVGRY` |
| DIRECTORATE_HEAD | `dh.lrde@ada.gov.in` | ADA-2003 | `U75B224ETPX66BQIH2MQ6XZQCYQDAL5Z` |
| SPONSOR | `sponsor.lrde@ada.gov.in` | LRDE-4410 | `76NC4WK45CHCNR4SNDY2QJZEESMJSFCJ` |

These accounts exist for a pilot. Before any real use, delete them or change every secret:
`./scripts/enroll-totp.sh admin.hr@ada.gov.in` re-enrols one account with a fresh random secret, and
`docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools npm run totp -w @ada/api -- --email <email>`
prints the current code for an account.

---

## 4. Seeded student data

| What | Value |
| --- | --- |
| Application number | `ADA/INT/R/2026/0001` |
| Date of birth (status check) | `2003-04-18` |
| Candidate | Ananya Iyer, `ananya.iyer@example.edu.in` |
| Status | `SUBMITTED` |
| Lab / level | LRDE / UG |

Public status check, no login:

```
http://localhost:4000/status   ->  ADA/INT/R/2026/0001  +  2003-04-18
```

Expected: candidate name, LRDE, UG, **SUBMITTED**. A wrong date of birth returns "not found" - that
is the check working, not a bug.

---

## 5. Student sign-in (referral flow)

Students cannot self-register. They need a referral code from a sponsor.

Where the codes are: the installer printed them once, and saved the same text to
**`seed-output.txt`** in the bundle folder. Look for the three lines under
`Referral codes issued just now`. They look like `LRDE-26-XXXX-XXXX`, two UG and one PG. The
database stores only a hash, so a lost code cannot be recovered - issue a new one instead:

```
docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools node /app/verify.mjs --issue-referral
```

That signs in as the sponsor, mints a fresh UG code, prints it, and shows the remaining quota
(3 per sponsor per year). Then use the public zone:

1. `http://localhost:4000` -> paste the referral code -> Continue.
2. Type any email (e.g. `test.student@example.edu.in`) -> Continue.
3. The 6-digit code appears on screen (demo mode) -> paste it -> you are in the application form.

Each code is single use. Reusing a spent code returns `CODE_ALREADY_USED`, which is correct.

---

## 6. Manual walkthrough by role

Sign in at `http://localhost:4001` unless stated otherwise.

| Role | Do this | Expected |
| --- | --- | --- |
| ADMIN_HR | Dashboard -> applications list | the seeded application `ADA/INT/R/2026/0001` appears; open it for the full packet |
| ADMIN_HR | Users screen | 7 staff accounts |
| ADMIN_HR | Configuration | 6 feature flags, 50 UG / 25 PG seats |
| DIRECTOR | open an application | read + approve/reject decisions; no user admin |
| COMMITTEE | application -> scoring | score form only on assigned applications |
| SECURITY | dashboard | document/verification queue; no user admin, no config |
| GUIDE | trainee list | attendance and clearance actions |
| DIRECTORATE_HEAD | directorate screen | topic approval and capacity |
| SPONSOR | referrals screen | own codes, quota 3/year, can issue or revoke |

Cross-zone checks worth doing once:

- `http://localhost:4000/api/staff/me` -> **404**, not 403. The staff tree is not mounted on the
  public host at all.
- `http://localhost:4001/api/public/info/guidelines` -> **404**. Neither is the public tree on the
  intranet host.
- Sign in on 4001, then open 4000 in the same browser: the staff session is not accepted there.

---

## 7. Checking the database directly (optional)

```
docker exec -it ada-db psql -U portal_owner -d ada_portal -c "select role, email from users order by role;"
```

Expected counts on a freshly seeded install:

| Table | Rows |
| --- | --- |
| `users` | 7 |
| `directorates` | 5 |
| `labs` | 5 |
| `students` | 1 |
| `applications` | 1 |
| `referral_codes` | 3 |
| `feature_flags` | 6 |
| `audit_log` | grows with every sign-in and action |

Other useful queries:

```
-- the seeded application
docker exec -it ada-db psql -U portal_owner -d ada_portal -c "select \"applicationNo\", status from applications;"

-- who signed in, and when
docker exec -it ada-db psql -U portal_owner -d ada_portal -c "select action, \"actorRole\", \"createdAt\" from audit_log order by \"createdAt\" desc limit 10;"

-- anything the guards refused
docker exec -it ada-db psql -U portal_owner -d ada_portal -c "select result, count(*) from zone_events group by result;"
```

`audit_log` receiving rows is the proof that sign-ins and state changes are being recorded.

---

## 8. Everyday commands

| Task | Command |
| --- | --- |
| status | `docker compose -f docker-compose.intranet.yml ps` |
| logs | `docker compose -f docker-compose.intranet.yml logs --tail=80` |
| stop (keeps data) | `docker compose -f docker-compose.intranet.yml stop` |
| start again | `docker compose -f docker-compose.intranet.yml start` |
| backup | `./scripts/backup.sh` (`.ps1` on Windows) |
| verify again | the command in section 2 |

**Never run `down -v`.** It deletes the `ada-portal_ada_pgdata` volume, i.e. every account,
application and audit row. `down` without `-v` is safe.

---

## 9. Reset to a clean test state

Only when you deliberately want to start over from zero:

```
docker compose -f docker-compose.intranet.yml down -v
docker compose -f docker-compose.intranet.yml up -d
docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools npm run db:seed -w @ada/api | tee seed-output.txt
```

New referral codes are printed each time a fresh database is seeded; the TOTP secrets stay the same
because they come from the email address.

---

## 10. If a check fails

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Verification could not run: fetch failed` | API containers are not up yet | `up -d`, wait for `(healthy)`, retry |
| `no devCode returned` | `.env` lost `ALLOW_DEV_OTP=true` | set it to `true`, `up -d`, retry |
| `seeded application ... HTTP 404` | database is empty (`install --no-seed`) | run the seed command in section 9 |
| `... HTTP 500` on status check | migrations not applied | `docker compose ... logs ada-migrate` |
| `RATE_LIMITED` | more than 5 sign-in codes in 10 minutes | wait 10 minutes |
| `FOREIGN_ORIGIN` in a browser | `.env` has the wrong `PUBLIC_APP_ORIGIN` / `INTERNAL_APP_ORIGIN` | fix them to the address you use in the browser, then `up -d` |
| `image not found locally` | images were never loaded | `docker load -i` both files in `images\` |

---

## 11. What this pilot does not do

Everything in section 3 is development data. The demo intentionally:

- shows OTP and authenticator codes on screen (`ALLOW_DEV_OTP=true`) - never leave this on for real use;
- seeds known accounts with derived secrets - replace them before go-live;
- stores only Aadhaar's last four digits, never the full number;
- has no SMS, no LDAP/AD sign-in, no document virus scanning, no WAF/alerting (milestone M7).

See `docs/GAP-ANALYSIS.md` for the full list before promising a go-live date.

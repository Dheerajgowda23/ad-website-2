# ADA Portal - Test Data Reference

One page to keep open while you test. Everything below is created by the seed that
`install.ps1` / `install.sh` runs, so a fresh install contains all of it. Use this file to know
*what to log in with and what to open*; `TESTING.md` explains how to run, verify, query and reset.

Version 1.0.0. Last verified against image `ada-portal-api:1.0.0`.

The offline intranet install and a development install (`git clone`, `docker compose up -d --build`)
both serve the two zones on `:4000`/`:4001` and run the same seed, so this page applies to both.

---

## 1. Staff logins (internal zone: http://localhost:4001)

Sign-in is three steps: type the email, then the 6-digit mailbox code shown on screen, then the
6-digit authenticator code shown on screen (the demo runs with `ALLOW_DEV_OTP=true`).

| Role | Email | TOTP secret (base32) | What to test with this login |
| --- | --- | --- | --- |
| ADMIN_HR | `admin.hr@ada.gov.in` | `M3XBWA3HB5HLZ5UW3J4PAZUNLKIZHUXE` | The applications list (all 20 cases), users screen (7 accounts), configuration (6 flags, 50 UG / 25 PG seats), audit log |
| DIRECTOR | `director@ada.gov.in` | `77QB77BYP6BRS6OI7PNMQGRUCUUBDG2E` | Approve/reject decisions - open `ADA/INT/R/2026/0010` (DIRECTOR_DECISION) |
| COMMITTEE | `committee@ada.gov.in` | `YP2RC4YZOXEKK4Y66TZOUMFIZDZJBUBR` | Scoring - open `ADA/INT/R/2026/0003` (COMMITTEE_REVIEW, awaits your score) |
| SECURITY | `security@ada.gov.in` | `T5RU4PGFJB7DVUF46Z4CLWPAUEUUXN3R` | Reporting-day queue: `0012` ACCEPTED, `0013` DOCUMENT_VERIFIED; pass issuing on `0014` |
| GUIDE | `guide@ada.gov.in` | `IU3F24RB5Q4K4GGMFNCBG2DTNBXNVGRY` | Trainees and attendance - `0015` IN_TRAINING, `0016` COMPLETED |
| DIRECTORATE_HEAD | `dh.lrde@ada.gov.in` | `U75B224ETPX66BQIH2MQ6XZQCYQDAL5Z` | Directorate screen, topic approval, capacity |
| SPONSOR | `sponsor.lrde@ada.gov.in` | `76NC4WK45CHCNR4SNDY2QJZEESMJSFCJ` | Own referral codes in every state (section 4), quota 3 per year |

Secrets are derived from the email address, so they are the same on every install. They can be
loaded into Google Authenticator / Microsoft Authenticator as a manual entry (time-based, 6 digits).

---

## 2. Student login (public zone: http://localhost:4000)

Students cannot register: a referral code plus the matching email is the login. These three codes
are fixed and are printed by every seed run.

| Referral code | Level | Email to type | Student | Date of birth |
| --- | --- | --- | --- | --- |
| `LRDE-26-DEMU-G239` | UG | `sneha.kulkarni@example.edu.in` | Sneha Kulkarni | `2003-02-11` |
| `LRDE-26-DEMU-G476` | UG | `imran.sheikh@example.edu.in` | Imran Sheikh | `2002-07-19` |
| `LRDE-26-DEMP-G58D` | PG | `divya.menon@example.edu.in` | Divya Menon | `2000-12-08` |

The form opens with that student's personal details, college, roll number and category already
filled in. The course and project values to type (discipline, branch, CGPA, dates, topic, synopsis)
are in `TESTING.md` section 5.1.

Each code works once. After a successful login it becomes USED, which is why the sponsor screen
shows a mix of states.

---

## 3. One application at every status

20 cases, one per pipeline status, all at LRDE. The public status check needs the number **and** the
date of birth. Staff open them from the applications list (no filter needed) or with the status
filter.

| Application number | Status | Candidate | Level | Date of birth | What to test |
| --- | --- | --- | --- | --- | --- |
| `ADA/INT/R/2026/0001` | SUBMITTED | Ananya Iyer | UG | `2003-04-18` | Student may still edit; HR can screen or return it |
| `ADA/INT/R/2026/0002` | HR_SCREENING | Rohan Mehta | UG | `2002-11-02` | HR screening actions, document check |
| `ADA/INT/R/2026/0003` | COMMITTEE_REVIEW | Priya Nair | PG | `2001-06-25` | Committee scoring (no score yet, quorum = 1) |
| `ADA/INT/R/2026/0004` | OFFER_ISSUED | Karthik Rao | UG | `2003-01-14` | Offer letter PDF, response deadline |
| `ADA/INT/R/2026/0005` | REJECTED_ELIGIBILITY | Meghna Das | UG | `2002-08-09` | Rejection reason `CGPA_BELOW_MINIMUM` |
| `ADA/INT/R/2026/0006` | IN_PROGRESS | Arjun Pillai | UG | `2003-09-30` | Half-filled draft (used code on the sponsor screen) |
| `ADA/INT/R/2026/0007` | INVITED | Aisha Khan | UG | `2003-05-22` | Invitation sent, form not opened yet |
| `ADA/INT/R/2026/0008` | RETURNED_FOR_CORRECTION | Vikram Joshi | UG | `2002-03-16` | Returned packet; student can resubmit |
| `ADA/INT/R/2026/0009` | NOT_RECOMMENDED | Neha Reddy | PG | `2001-09-27` | Committee said no, with a review on file |
| `ADA/INT/R/2026/0010` | DIRECTOR_DECISION | Aditya Kulkarni | UG | `2003-06-08` | Waiting for the Director's approve/reject |
| `ADA/INT/R/2026/0011` | REJECTED | Farhan Ali | UG | `2002-12-01` | Director rejection - terminal state |
| `ADA/INT/R/2026/0012` | ACCEPTED | Kavya Menon | UG | `2003-03-05` | Offer accepted; joining documents pending |
| `ADA/INT/R/2026/0013` | DOCUMENT_VERIFIED | Rahul Verma | UG | `2002-10-12` | College letter verified; ready for a pass |
| `ADA/INT/R/2026/0014` | SECURITY_PASS | Sneha Pillai | UG | `2003-07-30` | Pass `ADA/PASS/2026/0014` issued |
| `ADA/INT/R/2026/0015` | IN_TRAINING | Aman Gupta | UG | `2002-05-04` | Guide's trainee list, two months of attendance |
| `ADA/INT/R/2026/0016` | COMPLETED | Ritu Shah | UG | `2003-08-21` | Clearance done, certificate not issued |
| `ADA/INT/R/2026/0017` | CERTIFICATE_ISSUED | Suresh Babu | PG | `2001-11-11` | Certificate `ADA/CERT/2026/0017`; verify it on the public site |
| `ADA/INT/R/2026/0018` | WITHDRAWN | Tanvi Desai | UG | `2003-01-19` | Student withdrew |
| `ADA/INT/R/2026/0019` | CANCELLED | Manish Yadav | UG | `2002-04-02` | HR cancelled (candidate did not report) |
| `ADA/INT/R/2026/0020` | EXPIRED | Pooja Hegde | UG | `2003-10-15` | Invitation/offer lapsed |

Rows that exist behind these cases: 7 offers (6 accepted), 5 verified college letters, 4 security
passes, 6 attendance months, 10 committee reviews, 11 directorate assignments, 1 certificate.

If the database already had real submissions before seeding, a demo number that is already taken
moves to the `90xx` block (for example `ADA/INT/R/2026/9013`). The status and candidate stay the
same; use the number printed by the seed.

---

## 4. Referral codes on the sponsor screen

| Code | Level | State | Meaning |
| --- | --- | --- | --- |
| `LRDE-26-DEMU-G239` | UG | ACTIVE (until used) | Student login code for Sneha Kulkarni |
| `LRDE-26-DEMU-G476` | UG | ACTIVE (until used) | Student login code for Imran Sheikh |
| `LRDE-26-DEMP-G58D` | PG | ACTIVE (until used) | Student login code for Divya Menon |
| `LRDE-26-DEMR-EV22` | UG | REVOKED | Revoked by the sponsor - shows the revoked row |
| `LRDE-26-DEME-XP39` | PG | EXPIRED | Expired - shows the expired row |

Once you sign in as a student, that code turns USED and keeps its application link. Seeded codes do
not consume the sponsor's 3-per-year quota, so the SPONSOR login can still issue a fresh code.

---

## 5. Row counts on a fresh install

| Table | Rows |
| --- | --- |
| `users` | 7 (one per role) |
| `students` | 23 (20 demo candidates + 3 sign-in profiles) |
| `applications` | 20 (one per status) |
| `offers` | 7 |
| `documents` | 18 (5 verified) |
| `joining` (security passes) | 4 |
| `attendance` | 6 |
| `reviews` | 10 |
| `certificates` | 1 |
| `referral_codes` | 5 |
| `directorates` / `labs` / `feature_flags` | 5 / 5 / 6 |
| `audit_log` | grows with every sign-in and action |

Query them all at once:

```
docker exec -it ada-db psql -U portal_owner -d ada_portal -c "select (select count(*) from users) users, (select count(*) from students) students, (select count(*) from applications) apps, (select count(*) from offers) offers, (select count(*) from certificates) certs, (select count(*) from referral_codes) codes;"
```

---

## 6. Queries worth keeping

```
-- every status and how many cases sit in it
docker exec -it ada-db psql -U portal_owner -d ada_portal -c "select status, count(*) from applications group by status order by status;"

-- case list with candidate names
docker exec -it ada-db psql -U portal_owner -d ada_portal -c "select a.\"applicationNo\", a.status, s.\"fullName\", s.email, s.dob from applications a join students s on s.id = a.\"studentId\" order by a.\"applicationNo\";"

-- the student login codes and what happened to them
docker exec -it ada-db psql -U portal_owner -d ada_portal -c "select code_prefix, level, coalesce(bound_student_email,'-') as bound, case when used_by_application_id is not null then 'USED' when revoked_at is not null then 'REVOKED' when expires_at < now() then 'EXPIRED' else 'ACTIVE' end as state from referral_codes order by created_at;"

-- recent audit trail
docker exec -it ada-db psql -U portal_owner -d ada_portal -c "select action, \"actorRole\", \"createdAt\" from audit_log order by \"createdAt\" desc limit 15;"
```

---

## 7. Starting over

Only when you deliberately want a clean test database:

```
docker compose -f docker-compose.intranet.yml down -v
docker compose -f docker-compose.intranet.yml up -d
docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools npm run db:seed -w @ada/api | tee seed-output.txt
```

Every table above returns to the counts in section 5, and the student login codes work again. The
TOTP secrets never change because they come from the email address.

`down -v` deletes the database. `down` on its own keeps it.

On a development or friend-laptop install the same reset is:

```
docker compose down -v
docker compose up -d
docker compose run --rm -T migrate npm run db:seed -w @ada/api | tee seed-output.txt
```

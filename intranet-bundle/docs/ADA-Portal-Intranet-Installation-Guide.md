# ADA Internship & Project Work Portal
## Offline Intranet Installation and Operations Guide

Version 1.0 - pilot installation | 24 November 2026

> This guide is written for the person installing the portal on a computer that has no internet access. Everything the portal needs is inside this folder. You will not download, build, or install anything from the internet on that machine.

## 1. What you are installing

The portal is one database and two web applications:

- Public zone (port 4000): students, other DRDO labs, status checks and certificate verification.
- Internal zone (port 4001): ADA staff - Admin & HR, Director, Committee, Guide, Directorate Head, Security and Sponsors.

Both zones run from the same container image. The only differences are the ZONE setting and the database role each one connects as. The public zone cannot see internal routes at all: they are not registered in that process, so an internal URL on the public port returns 404.

This bundle is self-contained. It contains two Docker images (the application and PostgreSQL 16), the database scripts, the startup configuration, helper scripts for both Windows and Linux, and this guide.

| Component | Version in this bundle | Runs as |
|---|---|---|
| ada-portal-api | 1.0.0 (linux/amd64) | Two containers: public and internal |
| PostgreSQL | 16-alpine | One container, data in a Docker volume |
| User interfaces | Built into the API image | Served by the same process as its API |

## 2. Prerequisites

### 2.1 The computer

| Item | Minimum | Recommended |
|---|---|---|
| Operating system | Windows 10/11 64-bit, Ubuntu 22.04+, RHEL 8+ | Windows 11 or Ubuntu 24.04 |
| CPU | 2 cores, x86-64 | 4 cores |
| Memory | 4 GB free for Docker | 8 GB or more |
| Disk | 6 GB free | 20 GB free (database growth and backups) |
| Network | None needed for install | Intranet address for staff browsers |

> The images in this bundle are built for x86-64 (linux/amd64). That covers ordinary Intel and AMD desktops and servers. They will not run natively on an Apple Silicon or ARM server; ask for an arm64 bundle if that is your hardware.

### 2.2 Nothing else needs installing - but Docker does

The portal's own dependencies are already inside the folder. Node.js 22, every npm package, both React builds and PostgreSQL 16 live inside the images in images/. The intranet PC needs no Node.js, no npm, no database and no internet.

The one thing a bare PC lacks is the container runtime, because it is a system service rather than part of a project. Its installers are in prerequisites/, so this works offline too:

| PC | Installer in prerequisites/ |
|---|---|
| Windows 10/11 (x86-64) | windows/DockerDesktopInstaller.exe + windows/wsl_update_x64.msi |
| Ubuntu 22.04 | linux/ubuntu-jammy/ (five .deb files) |
| Ubuntu 24.04 | linux/ubuntu-noble/ (five .deb files) |
| RHEL / Rocky / other | Not bundled - install Docker Engine and the compose plugin from your OS media or internal repository |

#### Windows

Right-click PowerShell and choose "Run as administrator", then run the prerequisite installer from the bundle folder:

```
cd C:\ada-portal-intranet
powershell -ExecutionPolicy Bypass -File .\prerequisites\install-docker-windows.ps1
```

It checks for Administrator rights, enables the WSL 2 and Virtual Machine Platform features, installs the WSL 2 kernel update and installs Docker Desktop silently. Then:

1. Reboot Windows when it finishes.
2. Start Docker Desktop from the Start menu and wait until it says "Engine running".
3. Continue with section 5 of this guide.

#### Ubuntu / Debian

```
sudo ./prerequisites/install-docker-ubuntu.sh
# then log out and back in, so the docker group applies
./scripts/install.sh
```

> Docker Desktop is free for personal use, education and small organisations, but larger organisations need a paid Docker subscription. Docker Engine on Ubuntu is free software. If Docker Desktop is not licensed at your site, run the bundle on a Linux PC instead - the images and scripts are identical. Virtualisation must be enabled in the BIOS/UEFI on Windows; without it Docker Desktop cannot start.

Confirm Docker works before going further:

```
docker --version
docker compose version
docker info
```

docker info must print server information without an error. On Linux, if you see a permission denied error, log out and back in after the installer added you to the docker group.

### 2.3 Ports

| Port | Used by | Exposure |
|---|---|---|
| 4000 | Public zone (API + public UI) | Staff and students who need the public portal |
| 4001 | Internal zone (API + staff UI) | ADA intranet only |
| 5433 | PostgreSQL | Loopback only (127.0.0.1) - never expose it |

If a port is already taken on the machine, change PUBLIC_HOST_PORT, INTERNAL_HOST_PORT or POSTGRES_HOST_PORT in the .env file before installing. Nothing else needs to change.

## 3. What is in the folder

```
ada-portal-intranet/
  README.txt                     start here (short version)
  docker-compose.intranet.yml    the stack definition
  .env.example                   configuration template (installer writes .env)
  images/                        the two Docker images (the portal and its dependencies)
    ada-portal-api-1.0.0-linux-amd64.tar.gz     Node 22 + all npm packages + both UIs + API
    postgres-16-alpine-linux-amd64.tar.gz       PostgreSQL 16
  prerequisites/                 Docker installers for a bare PC (still offline)
    windows/DockerDesktopInstaller.exe, wsl_update_x64.msi
    linux/ubuntu-jammy/, linux/ubuntu-noble/  Docker Engine .deb files
    install-docker-windows.ps1, install-docker-ubuntu.sh
  source/                        the application source, for audit and reference
  db/grants.sql                  creates the two restricted database roles
  db/init-roles.sh               feeds the generated role passwords to grants.sql
  scripts/                       install, start, stop, status, logs, backup, restore,
                                 enrol-totp, issue-referral, use-host
                                 (.sh for Linux/macOS, .ps1 for Windows)
  docs/                          this guide (PDF and DOCX) and the gap analysis
  SHA256SUMS.txt                 checksums to prove the copy is intact
```

Do not rename or move files out of the folder. The scripts find everything relative to their own location.

## 4. Copy the bundle to the intranet PC

1. Copy the whole ada-portal-intranet folder to the intranet PC, for example to C:\ada-portal-intranet on Windows or /opt/ada-portal-intranet on Linux.
2. Copy SHA256SUMS.txt with it.
3. Verify the copy before installing. A truncated image file is the most common cause of a failed first install.

Windows (PowerShell, inside the folder):

```
Get-FileHash images\*.tar.gz -Algorithm SHA256 | Format-List
# compare each hash with the matching line in SHA256SUMS.txt
```

Linux:

```
cd /opt/ada-portal-intranet
sha256sum -c SHA256SUMS.txt
```

> The images are large (about 200 MB each compressed). Copying from a USB drive is normal. Do not use a network share that drops long copies, and do not interrupt docker load.

## 5. Install - Windows

Open PowerShell in the bundle folder (Shift + right-click the folder, "Open PowerShell window here", or cd into it). Then run:

```
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

If staff will reach the portal by a host name or IP rather than localhost, pass it now so the browser origin matches what people type:

```
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -PortalHost 10.20.30.40
```

What the installer does, in order:

1. Checks that Docker is installed and its engine is running.
2. Loads both images from images\ into Docker. No internet is used.
3. Writes .env with randomly generated database passwords and signing secrets, and restricts the file.
4. Starts PostgreSQL, waits for it, then applies the database migrations as the schema owner.
5. Starts the public and internal zones and waits until both answer their health check.
6. Seeds the seven staff accounts, the directorates, the labs, the feature flags, one sample application, and three referral codes. Seeding is safe to repeat: it updates rows instead of duplicating them.

Expected final lines:

```
==> Installed
  Public zone (students/other labs) : http://localhost:4000
  Internal zone (ADA staff)         : http://localhost:4001
```

The seeded account table and the three one-time referral codes are printed during seeding and saved to seed-output.txt in the bundle folder. Read them there; the codes cannot be recovered later.

> If PowerShell refuses to run the script, that is the default execution policy, not a problem with the bundle. Use the -ExecutionPolicy Bypass form shown above, or run Set-ExecutionPolicy -Scope Process Bypass first.

## 6. Install - Linux or macOS

```
cd /opt/ada-portal-intranet
chmod +x scripts/*.sh
./scripts/install.sh
# or, for a host name:
PORTAL_HOST=internship.ada.internal ./scripts/install.sh
```

The steps and output are the same as the Windows installer. If curl is missing on a minimal server, install it from your OS media (apt install curl) or check health with docker compose -f docker-compose.intranet.yml ps - the containers report healthy on their own.

## 7. Verify the installation

Run the status script:

```
# Windows
.\scripts\status.ps1
# Linux
./scripts/status.sh
```

You should see four containers, with db, api-public and api-internal marked healthy, and:

```
port 4000 -> 200 {"ok":true,"zone":"public"}
port 4001 -> 200 {"ok":true,"zone":"internal"}
```

Then check the two most important guarantees in a browser or with curl:

```
# 1. Each zone serves its own UI
curl -I http://localhost:4000/          # 200, public SPA
curl -I http://localhost:4001/          # 200, staff SPA

# 2. Internal routes do not exist on the public port (expect 404, not 403)
curl -i http://localhost:4000/api/staff/config
```

The second check is the zone split. A 404 means the public process genuinely has no staff router, which is the intended design.

## 8. First sign-in

### 8.1 Staff (internal zone)

1. Open http://localhost:4001 (or http://<host>:4001). This is the intranet login page. There is no role selector: the account decides the role.
2. Enter a staff email from seed-output.txt, for example admin.hr@ada.gov.in.
3. Request the code. In pilot mode the six-digit code appears in a dashed "development code" box on the screen, because there is no mail server yet. In production mode it is emailed instead.
4. Enter the code. The portal now asks for the authenticator code. In pilot mode that code is also shown on screen. In production, use the phone that was enrolled for that account.
5. You land on the dashboard for that role.

### 8.2 Student (public zone)

Issue a referral code first - students cannot register without one:

```
.\scripts\issue-referral.ps1 -Level UG -Name "Test Student" -Email test@college.edu.in
# Linux: ./scripts/issue-referral.sh UG "Test Student" test@college.edu.in
```

1. Open http://localhost:4000 and choose the student sign-in.
2. Enter the referral code. The portal shows who referred the student, then asks for an email address.
3. Request the code (shown on screen in pilot mode), enter it, and the application opens in progress.

### 8.3 Seeded accounts

| Role | Email | What it is for |
|---|---|---|
| ADMIN_HR | admin.hr@ada.gov.in | Casework and configuration, one dashboard |
| DIRECTOR | director@ada.gov.in | Approve or reject decisions, capacity override |
| COMMITTEE | committee@ada.gov.in | Score assigned packets |
| SECURITY | security@ada.gov.in | Reporting-day queue, passes, document checks |
| GUIDE | guide@ada.gov.in | Trainees, attendance, clearance |
| DIRECTORATE_HEAD | dh.lrde@ada.gov.in | Confirm guide and capacity, approve topics |
| SPONSOR | sponsor.lrde@ada.gov.in | Issue and manage referral codes |

> These accounts exist so the system can be demonstrated and tested. Before real use, rename or disable them, enrol a real authenticator for every person (section 11), and turn off development OTP echo (section 12).

## 9. Everyday operations

| Task | Windows | Linux |
|---|---|---|
| Start | .\scripts\start.ps1 | ./scripts/start.sh |
| Stop (data kept) | .\scripts\stop.ps1 | ./scripts/stop.sh |
| Status and health | .\scripts\status.ps1 | ./scripts/status.sh |
| Logs | docker logs -f ada-api-internal | ./scripts/logs.sh internal |
| Backup database | .\scripts\backup.ps1 | ./scripts/backup.sh |
| Restore | .\scripts\restore.ps1 -Dump backups\ada-....dump | ./scripts/restore.sh backups/ada-....dump |
| Enrol authenticator | .\scripts\enroll-totp.ps1 <email> | ./scripts/enroll-totp.sh <email> |
| Issue referral | .\scripts\issue-referral.ps1 -Level UG -Name X -Email y | ./scripts/issue-referral.sh UG X y |
| Change portal host | edit .env, then start.ps1 | ./scripts/use-host.sh <host> |

### 9.1 Backups

A backup is three things: a database dump, the .env file, and the uploaded-documents folder. Run the backup script on a schedule you can defend - daily is normal - and copy all of it off the machine. The images can be rebuilt from this bundle; the data cannot.

Uploaded college letters, IDs and police clearances are files on a Docker volume, not rows in the database. The script copies them into backups/files-<timestamp> as well as dumping the database, because restoring only the database leaves document rows pointing at nothing. To restore the files, copy that folder back: docker cp backups/files-<timestamp>/. ada-api-public:/app/data/files/

Rehearse a restore before go-live, on a test machine or after taking a fresh backup. A backup that has never been restored is not a backup. The restore script asks you to type RESTORE before it touches anything.

### 9.2 Upgrading to a newer build

1. Take a backup.
2. Load the new image: docker load -i images\ada-portal-api-<new>.tar.gz
3. Set ADA_IMAGE_TAG=<new-version> in .env.
4. Run the start script. The migrate container runs automatically and applies any new migrations before the APIs start.
5. Check the status script and sign in once.

## 10. Configuration reference (.env)

| Setting | Meaning |
|---|---|
| PORTAL_ENV | development or production. Production disables the on-screen OTP echo. |
| ALLOW_DEV_OTP | true shows OTP and TOTP codes on the login screen. Must be false in production. |
| COOKIE_SECURE | true only behind HTTPS. Over plain http it must be false or the browser drops the session cookie. |
| PUBLIC_APP_ORIGIN | The exact URL staff and students use for port 4000. Must match the browser address. |
| INTERNAL_APP_ORIGIN | The exact URL for port 4001. |
| PUBLIC_HOST_PORT / INTERNAL_HOST_PORT | Host ports mapped into the containers. Default 4000 / 4001. |
| POSTGRES_* | Database name, owner and passwords. Generated at install; keep them. |
| PORTAL_PUBLIC_DB_PASSWORD / PORTAL_INTERNAL_DB_PASSWORD | Passwords for the two restricted database roles. |
| SESSION_SECRET, OTP_PEPPER, REFERRAL_HMAC_PEPPER, TOTP_PEPPER | Signing and hashing secrets. Changing them invalidates sessions, pending OTPs and referral lookups. |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM | Internal mail relay used for OTP and notification email. |

> If you edit .env after the database volume has been created, changing POSTGRES_PASSWORD will not change the existing database password and the APIs will fail to connect. Either keep the original value or recreate the volume deliberately (which erases data).

### 10.1 Changing the address staff use

The origin must match the browser address exactly, including the port. If the portal is opened as http://10.20.30.40:4000 but PUBLIC_APP_ORIGIN says localhost, the server refuses signed-in writes with a FOREIGN_ORIGIN error. Fix it with the use-host script (Linux) or by editing both origin lines in .env and restarting (Windows).

## 11. Real staff sign-in: enrol authenticators

The seeded TOTP secrets are a development convenience. For real users, enrol each person's phone:

```
.\scripts\enroll-totp.ps1 admin.hr@ada.gov.in      # prints a QR in the terminal
.\scripts\enroll-totp.ps1 director@ada.gov.in --qr C:\temp\director.png
```

The script prints a QR code and an otpauth:// URI, and replaces the account's previous secret. Show the QR to the person and have them scan it with Microsoft Authenticator, Google Authenticator or FreeOTP. Do not send the secret by email.

A staff member whose account has no authenticator is enrolled at sign-in: after the email code, the portal shows the QR and asks for the first authenticator code, then stores the secret. No command line is needed for that person. Rotation is the command above: run it again and the old secret stops working immediately.

## 12. Turning on production mode

Pilot mode exists so the portal can be demonstrated without mail. Before it is used for real applications, do all of the following:

1. Configure the internal SMTP relay in .env (SMTP_HOST, SMTP_PORT, and credentials if the relay needs them). Test by requesting a staff OTP and confirming the email arrives.
2. Set PORTAL_ENV=production and ALLOW_DEV_OTP=false. Restart. The login screen must no longer show codes; if it does, the value did not take effect.
3. Decide on HTTPS. If a reverse proxy terminates TLS in front of the portal, set COOKIE_SECURE=true and use https:// in the two origin values. If the portal stays on plain http inside the intranet, leave COOKIE_SECURE=false and record that decision.
4. Enrol a real authenticator for every staff account and disable the demo accounts you do not need.
5. Confirm the server clock is synchronised (NTP). TOTP codes are time-based; a clock minutes out of step rejects correct codes.
6. Take a backup, then rehearse a restore.
7. Restrict port 4001 to the ADA intranet at the firewall, and keep 5433 on loopback only.

> With ALLOW_DEV_OTP=false and no working SMTP_HOST, nobody can sign in. The API returns EMAIL_UNAVAILABLE with a clear message rather than pretending the code was sent. That is intentional, but it means SMTP is the first thing to verify after switching modes.

## 13. Network layout

For a pilot, one computer running both zones is enough. For the real deployment the zones belong in different network positions, because the whole point is that students are outside ADA and staff are inside:

- Intranet host: runs the database, the internal zone on 4001, and the SMTP relay connection.
- DMZ host: runs only the public zone container on 4000, with its own copy of .env whose DATABASE_URL points at the intranet database over a one-way firewall rule.
- Only the public zone is reachable from the internet. Port 4001 is never published outside ADA.

If you split the two zones across hosts, change the public container's DATABASE_URL to the database host and keep the same restricted role (portal_public). The schema and grants are unchanged; only the connection string differs.

## 14. Troubleshooting

| Symptom | Cause | What to do |
|---|---|---|
| docker: command not found | Docker not installed or not on PATH | Install Docker, reopen the terminal |
| Cannot connect to the Docker daemon | Engine not running | Start Docker Desktop / systemctl start docker |
| port is already allocated | Another program uses 4000/4001/5433 | Change the *_HOST_PORT values in .env, then start |
| api containers restart repeatedly | Database password changed after the volume was created | Restore the original POSTGRES_PASSWORD, or recreate the volume deliberately |
| health check fails, logs show P1001 | API cannot reach db | docker compose ps; check db is healthy; check .env |
| No OTP shown and no email arrives | ALLOW_DEV_OTP=false without SMTP | Configure SMTP, or use pilot mode |
| OTP shown despite ALLOW_DEV_OTP=false | PORTAL_ENV is still development | Set PORTAL_ENV=production and restart |
| Sign-in appears to succeed, then you are logged out | COOKIE_SECURE=true over http | Set COOKIE_SECURE=false, or serve the portal over HTTPS |
| 403 FOREIGN_ORIGIN on save | Origin in .env differs from the browser address | Fix PUBLIC_APP_ORIGIN / INTERNAL_APP_ORIGIN, restart |
| Authenticator code always rejected | Server clock drift | Enable NTP time sync and try again |
| Too many requests (429) | OTP rate limit: 5 attempts per 10 minutes per IP | Wait, or restart the affected API container |
| Referral code rejected | Used, expired, revoked, or wrong lab/year | Issue a new code; the error is deliberately generic |
| Browser shows an old page after an upgrade | Cached assets | Hard refresh (Ctrl+F5); index.html is served no-store |

For anything else, collect these before asking for help:

```
docker compose -f docker-compose.intranet.yml ps
docker logs --tail=200 ada-api-internal
docker logs --tail=200 ada-db
# redact .env secrets before sharing
```

## 15. Security checklist

- POSTGRES on 127.0.0.1 only; never publish 5432/5433 to the LAN.
- 4001 reachable only from the ADA intranet.
- .env readable by the service account only, and never copied into a ticket or an email.
- ALLOW_DEV_OTP=false and PORTAL_ENV=production for real data.
- Every staff account has its own enrolled authenticator; no shared logins.
- Backups taken daily, stored off the machine, and one restore rehearsed.
- Audit log reviewed - every sign-in, referral redemption, status change, document download and permission denial is in it.
- Aadhaar is stored as last four digits plus a keyed hash only; the portal never asks for the full number.
- No college accounts exist by design: the signed college letter is uploaded and verified by Admin & HR.

## 16. What this version does not do yet

Be clear with users about the following before go-live. They are tracked in docs/GAP-ANALYSIS.md:

- Document upload and virus scanning: college letters and certificates are represented as document records; the file store (MinIO/ClamAV) is not wired yet, so verification currently records a human decision rather than viewing an uploaded scan.
- Resume review, virus-scan quarantine, WAF rules and alerting (milestone M7 hardening).
- LDAP/AD single sign-on: email OTP plus TOTP is the v1 login; the LDAP seam is left open.
- SMS, payments/stipend, eSign, translations and a mobile app are deliberately out of scope.

## 17. Support

| Question | Contact |
|---|---|
| Installation and server | ADA IT / the person who built this bundle |
| Accounts, roles, referrals | Admin & HR (the ADMIN_HR account) |
| Policy and eligibility | Director (Admin & HR) |

Keep this guide, seed-output.txt, SHA256SUMS.txt and a copy of .env with the installation records.

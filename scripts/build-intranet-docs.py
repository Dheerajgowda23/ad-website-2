#!/usr/bin/env python3
"""Render the intranet installation guide from one source into Markdown, DOCX and PDF.

Run with the project-local venv:
    .tools/venv/bin/python scripts/build-intranet-docs.py
"""
from __future__ import annotations

import os
import textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "intranet-bundle", "docs")

TITLE = "ADA Internship & Project Work Portal"
SUBTITLE = "Offline Intranet Installation and Operations Guide"
VERSION = "Version 1.0 - pilot installation"
DATE = "25 November 2026"

# --------------------------------------------------------------------------
# Content. Blocks: h1/h2/h3/p/bullet/numbered/code/table/note/pagebreak
# --------------------------------------------------------------------------
CONTENT = [
    ("note", "This guide is written for the person installing the portal on a computer that has no internet "
             "access. Everything the portal needs is inside this folder. You will not download, build, or "
             "install anything from the internet on that machine."),

    ("h1", "1. What you are installing"),
    ("p", "The portal is one database and two web applications:"),
    ("bullet", [
        "Public zone (port 4000): students, other DRDO labs, status checks and certificate verification.",
        "Internal zone (port 4001): ADA staff - Admin & HR, Director, Committee, Guide, Directorate Head, "
        "Security and Sponsors.",
    ]),
    ("p", "Both zones run from the same container image. The only differences are the ZONE setting and the "
          "database role each one connects as. The public zone cannot see internal routes at all: they are "
          "not registered in that process, so an internal URL on the public port returns 404."),
    ("p", "This bundle is self-contained. It contains two Docker images (the application and PostgreSQL 16), "
          "the database scripts, the startup configuration, helper scripts for both Windows and Linux, and "
          "this guide."),
    ("table", [
        ["Component", "Version in this bundle", "Runs as"],
        ["ada-portal-api", "1.0.0 (linux/amd64)", "Two containers: public and internal"],
        ["PostgreSQL", "16-alpine", "One container, data in a Docker volume"],
        ["User interfaces", "Built into the API image", "Served by the same process as its API"],
    ]),

    ("h1", "2. Prerequisites"),
    ("h2", "2.1 The computer"),
    ("table", [
        ["Item", "Minimum", "Recommended"],
        ["Operating system", "Windows 10/11 64-bit, Ubuntu 22.04+, RHEL 8+", "Windows 11 or Ubuntu 24.04"],
        ["CPU", "2 cores, x86-64", "4 cores"],
        ["Memory", "4 GB free for Docker", "8 GB or more"],
        ["Disk", "6 GB free", "20 GB free (database growth and backups)"],
        ["Network", "None needed for install", "Intranet address for staff browsers"],
    ]),
    ("note", "The images in this bundle are built for x86-64 (linux/amd64). That covers ordinary Intel and AMD "
             "desktops and servers. They will not run natively on an Apple Silicon or ARM server; ask for an "
             "arm64 bundle if that is your hardware."),
    ("h2", "2.2 Nothing else needs installing - but Docker does"),
    ("p", "The portal's own dependencies are already inside the folder. Node.js 22, every npm package, both "
          "React builds and PostgreSQL 16 live inside the images in images/. The intranet PC needs no Node.js, "
          "no npm, no database and no internet."),
    ("p", "The one thing a bare PC lacks is the container runtime, because it is a system service rather "
          "than part of a project. Its installers are in prerequisites/, so this works offline too:"),
    ("table", [
        ["PC", "Installer in prerequisites/"],
        ["Windows 10/11 (x86-64)", "windows/DockerDesktopInstaller.exe + windows/wsl_update_x64.msi"],
        ["Ubuntu 22.04", "linux/ubuntu-jammy/ (five .deb files)"],
        ["Ubuntu 24.04", "linux/ubuntu-noble/ (five .deb files)"],
        ["RHEL / Rocky / other", "Not bundled - install Docker Engine and the compose plugin from your OS media or internal repository"],
    ]),
    ("h3", "Windows"),
    ("p", "Right-click PowerShell and choose \"Run as administrator\", then run the prerequisite installer "
          "from the bundle folder:"),
    ("code", ["cd C:\\ada-portal-intranet",
              "powershell -ExecutionPolicy Bypass -File .\\prerequisites\\install-docker-windows.ps1"]),
    ("p", "It checks for Administrator rights, enables the WSL 2 and Virtual Machine Platform features, "
          "installs the WSL 2 kernel update and installs Docker Desktop silently. Then:"),
    ("number", [
        "Reboot Windows when it finishes.",
        "Start Docker Desktop from the Start menu and wait until it says \"Engine running\".",
        "Continue with section 5 of this guide.",
    ]),
    ("h3", "Ubuntu / Debian"),
    ("code", ["sudo ./prerequisites/install-docker-ubuntu.sh", "# then log out and back in, so the docker group applies", "./scripts/install.sh"]),
    ("note", "Docker Desktop is free for personal use, education and small organisations, but larger "
             "organisations need a paid Docker subscription. Docker Engine on Ubuntu is free software. If "
             "Docker Desktop is not licensed at your site, run the bundle on a Linux PC instead - the images "
             "and scripts are identical. Virtualisation must be enabled in the BIOS/UEFI on Windows; without "
             "it Docker Desktop cannot start."),
    ("p", "Confirm Docker works before going further:"),
    ("code", ["docker --version", "docker compose version", "docker info"]),
    ("p", "docker info must print server information without an error. On Linux, if you see a permission "
          "denied error, log out and back in after the installer added you to the docker group."),
    ("h2", "2.3 Ports"),
    ("table", [
        ["Port", "Used by", "Exposure"],
        ["4000", "Public zone (API + public UI)", "Staff and students who need the public portal"],
        ["4001", "Internal zone (API + staff UI)", "ADA intranet only"],
        ["5433", "PostgreSQL", "Loopback only (127.0.0.1) - never expose it"],
    ]),
    ("p", "If a port is already taken on the machine, change PUBLIC_HOST_PORT, INTERNAL_HOST_PORT or "
          "POSTGRES_HOST_PORT in the .env file before installing. Nothing else needs to change."),

    ("h1", "3. What is in the folder"),
    ("code", [
        "ada-portal-intranet/",
        "  README.txt                     start here (short version)",
        "  docker-compose.intranet.yml    the stack definition",
        "  .env.example                   configuration template (installer writes .env)",
        "  images/                        the two Docker images (the portal and its dependencies)",
        "    ada-portal-api-1.0.0-linux-amd64.tar.gz     Node 22 + all npm packages + both UIs + API",
        "    postgres-16-alpine-linux-amd64.tar.gz       PostgreSQL 16",
        "  prerequisites/                 Docker installers for a bare PC (still offline)",
        "    windows/DockerDesktopInstaller.exe, wsl_update_x64.msi",
        "    linux/ubuntu-jammy/, linux/ubuntu-noble/  Docker Engine .deb files",
        "    install-docker-windows.ps1, install-docker-ubuntu.sh",
        "  source/                        the application source, for audit and reference",
        "  db/grants.sql                  creates the two restricted database roles",
        "  db/init-roles.sh               feeds the generated role passwords to grants.sql",
        "  scripts/                       install, start, stop, status, logs, backup, restore,",
        "                                 enrol-totp, issue-referral, use-host",
        "                                 (.sh for Linux/macOS, .ps1 for Windows)",
        "  docs/                          this guide (PDF and DOCX) and the gap analysis",
        "  SHA256SUMS.txt                 checksums to prove the copy is intact",
    ]),
    ("p", "Do not rename or move files out of the folder. The scripts find everything relative to their own "
          "location."),

    ("h1", "4. Copy the bundle to the intranet PC"),
    ("number", [
        "Copy the whole ada-portal-intranet folder to the intranet PC, for example to C:\\ada-portal-intranet "
        "on Windows or /opt/ada-portal-intranet on Linux.",
        "Copy SHA256SUMS.txt with it.",
        "Verify the copy before installing. A truncated image file is the most common cause of a failed "
        "first install.",
    ]),
    ("p", "Windows (PowerShell, inside the folder):"),
    ("code", [
        "Get-FileHash images\\*.tar.gz -Algorithm SHA256 | Format-List",
        "# compare each hash with the matching line in SHA256SUMS.txt",
    ]),
    ("p", "Linux:"),
    ("code", ["cd /opt/ada-portal-intranet", "sha256sum -c SHA256SUMS.txt"]),
    ("note", "The images are large (about 200 MB each compressed). Copying from a USB drive is normal. Do not use a "
             "network share that drops long copies, and do not interrupt docker load."),

    ("h1", "5. Install - Windows"),
    ("p", "Open PowerShell in the bundle folder (Shift + right-click the folder, \"Open PowerShell window "
          "here\", or cd into it). Then run:"),
    ("code", ["powershell -ExecutionPolicy Bypass -File .\\scripts\\install.ps1"]),
    ("p", "If staff will reach the portal by a host name or IP rather than localhost, pass it now so the "
          "browser origin matches what people type:"),
    ("code", ["powershell -ExecutionPolicy Bypass -File .\\scripts\\install.ps1 -PortalHost 10.20.30.40"]),
    ("p", "What the installer does, in order:"),
    ("number", [
        "Checks that Docker is installed and its engine is running.",
        "Loads both images from images\\ into Docker. No internet is used.",
        "Writes .env with randomly generated database passwords and signing secrets, and restricts the file.",
        "Starts PostgreSQL, waits for it, then applies the database migrations as the schema owner.",
        "Starts the public and internal zones and waits until both answer their health check.",
        "Seeds the seven staff accounts, the directorates, the labs, the feature flags, one sample "
        "application, and three referral codes. Seeding is safe to repeat: it updates rows instead of "
        "duplicating them.",
    ]),
    ("p", "Expected final lines:"),
    ("code", [
        "==> Installed",
        "  Public zone (students/other labs) : http://localhost:4000",
        "  Internal zone (ADA staff)         : http://localhost:4001",
    ]),
    ("p", "The seeded account table and the three one-time referral codes are printed during seeding and "
          "saved to seed-output.txt in the bundle folder. Read them there; the codes cannot be recovered "
          "later."),
    ("note", "If PowerShell refuses to run the script, that is the default execution policy, not a problem "
             "with the bundle. Use the -ExecutionPolicy Bypass form shown above, or run "
             "Set-ExecutionPolicy -Scope Process Bypass first."),

    ("h1", "6. Install - Linux or macOS"),
    ("code", [
        "cd /opt/ada-portal-intranet",
        "chmod +x scripts/*.sh",
        "./scripts/install.sh",
        "# or, for a host name:",
        "PORTAL_HOST=internship.ada.internal ./scripts/install.sh",
    ]),
    ("p", "The steps and output are the same as the Windows installer. If curl is missing on a minimal "
          "server, install it from your OS media (apt install curl) or check health with "
          "docker compose -f docker-compose.intranet.yml ps - the containers report healthy on their own."),

    ("h1", "7. Verify the installation"),
    ("p", "Run the status script:"),
    ("code", ["# Windows", ".\\scripts\\status.ps1", "# Linux", "./scripts/status.sh"]),
    ("p", "You should see four containers, with db, api-public and api-internal marked healthy, and:"),
    ("code", [
        'port 4000 -> 200 {"ok":true,"zone":"public"}',
        'port 4001 -> 200 {"ok":true,"zone":"internal"}',
    ]),
    ("p", "Then check the two most important guarantees in a browser or with curl:"),
    ("code", [
        "# 1. Each zone serves its own UI",
        "curl -I http://localhost:4000/          # 200, public SPA",
        "curl -I http://localhost:4001/          # 200, staff SPA",
        "",
        "# 2. Internal routes do not exist on the public port (expect 404, not 403)",
        "curl -i http://localhost:4000/api/staff/config",
    ]),
    ("p", "The second check is the zone split. A 404 means the public process genuinely has no staff router, "
          "which is the intended design."),

    ("h1", "8. First sign-in"),
    ("h2", "8.1 Staff (internal zone)"),
    ("number", [
        "Open http://localhost:4001 (or http://<host>:4001). This is the intranet login page. There is no "
        "role selector: the account decides the role.",
        "Enter a staff email from seed-output.txt, for example admin.hr@ada.gov.in.",
        "Request the code. In pilot mode the six-digit code appears in a dashed \"development code\" box on "
        "the screen, because there is no mail server yet. In production mode it is emailed instead.",
        "Enter the code. The portal now asks for the authenticator code. In pilot mode that code is also "
        "shown on screen. In production, use the phone that was enrolled for that account.",
        "You land on the dashboard for that role.",
    ]),
    ("h2", "8.2 Student (public zone)"),
    ("p", "Issue a referral code first - students cannot register without one:"),
    ("code", [".\\scripts\\issue-referral.ps1 -Level UG -Name \"Test Student\" -Email test@college.edu.in",
              "# Linux: ./scripts/issue-referral.sh UG \"Test Student\" test@college.edu.in"]),
    ("number", [
        "Open http://localhost:4000 and choose the student sign-in.",
        "Enter the referral code. The portal shows who referred the student, then asks for an email address.",
        "Request the code (shown on screen in pilot mode), enter it, and the application opens in progress.",
    ]),
    ("h2", "8.3 Seeded accounts"),
    ("table", [
        ["Role", "Email", "What it is for"],
        ["ADMIN_HR", "admin.hr@ada.gov.in", "Casework and configuration, one dashboard"],
        ["DIRECTOR", "director@ada.gov.in", "Approve or reject decisions, capacity override"],
        ["COMMITTEE", "committee@ada.gov.in", "Score assigned packets"],
        ["SECURITY", "security@ada.gov.in", "Reporting-day queue, passes, document checks"],
        ["GUIDE", "guide@ada.gov.in", "Trainees, attendance, clearance"],
        ["DIRECTORATE_HEAD", "dh.lrde@ada.gov.in", "Confirm guide and capacity, approve topics"],
        ["SPONSOR", "sponsor.lrde@ada.gov.in", "Issue and manage referral codes"],
    ]),
    ("note", "These accounts exist so the system can be demonstrated and tested. Before real use, rename or "
             "disable them, enrol a real authenticator for every person (section 11), and turn off "
             "development OTP echo (section 12)."),

    ("h1", "9. Everyday operations"),
    ("table", [
        ["Task", "Windows", "Linux"],
        ["Start", ".\\scripts\\start.ps1", "./scripts/start.sh"],
        ["Stop (data kept)", ".\\scripts\\stop.ps1", "./scripts/stop.sh"],
        ["Status and health", ".\\scripts\\status.ps1", "./scripts/status.sh"],
        ["Logs", "docker logs -f ada-api-internal", "./scripts/logs.sh internal"],
        ["Backup database", ".\\scripts\\backup.ps1", "./scripts/backup.sh"],
        ["Restore", ".\\scripts\\restore.ps1 -Dump backups\\ada-....dump", "./scripts/restore.sh backups/ada-....dump"],
        ["Enrol authenticator", ".\\scripts\\enroll-totp.ps1 <email>", "./scripts/enroll-totp.sh <email>"],
        ["Issue referral", ".\\scripts\\issue-referral.ps1 -Level UG -Name X -Email y", "./scripts/issue-referral.sh UG X y"],
        ["Change portal host", "edit .env, then start.ps1", "./scripts/use-host.sh <host>"],
    ]),
    ("h2", "9.1 Backups"),
    ("p", "A backup is three things: a database dump, the .env file, and the uploaded-documents folder. "
          "Run the backup script on a schedule you can defend - daily is normal - and copy all of it off "
          "the machine. The images can be rebuilt from this bundle; the data cannot."),
    ("p", "Uploaded college letters, IDs and police clearances are files on a Docker volume, not rows in "
          "the database. The script copies them into backups/files-<timestamp> as well as dumping the "
          "database, because restoring only the database leaves document rows pointing at nothing. To "
          "restore the files, copy that folder back: docker cp backups/files-<timestamp>/. "
          "ada-api-public:/app/data/files/"),
    ("p", "Rehearse a restore before go-live, on a test machine or after taking a fresh backup. A backup that "
          "has never been restored is not a backup. The restore script asks you to type RESTORE before it "
          "touches anything."),
    ("p", "Documents are encrypted at rest with FILE_ENCRYPTION_KEY (or SESSION_SECRET if that key is unset). "
          "The .env in the backup holds it: restore the database and the files without that exact value and "
          "every document is unreadable ciphertext. Treat the .env as part of the data, not as configuration."),
    ("h2", "9.2 Upgrading to a newer build"),
    ("number", [
        "Take a backup.",
        "Load the new image: docker load -i images\\ada-portal-api-<new>.tar.gz",
        "Set ADA_IMAGE_TAG=<new-version> in .env.",
        "Run the start script. The migrate container runs automatically and applies any new migrations "
        "before the APIs start.",
        "Check the status script and sign in once.",
    ]),

    ("h1", "10. Configuration reference (.env)"),
    ("table", [
        ["Setting", "Meaning"],
        ["PORTAL_ENV", "development or production. Production disables the on-screen OTP echo."],
        ["ALLOW_DEV_OTP", "true shows OTP and TOTP codes on the login screen. Must be false in production."],
        ["COOKIE_SECURE", "true only behind HTTPS. Over plain http it must be false or the browser drops the session cookie."],
        ["PUBLIC_APP_ORIGIN", "The exact URL staff and students use for port 4000. Must match the browser address."],
        ["INTERNAL_APP_ORIGIN", "The exact URL for port 4001."],
        ["PUBLIC_HOST_PORT / INTERNAL_HOST_PORT", "Host ports mapped into the containers. Default 4000 / 4001."],
        ["POSTGRES_*", "Database name, owner and passwords. Generated at install; keep them."],
        ["PORTAL_PUBLIC_DB_PASSWORD / PORTAL_INTERNAL_DB_PASSWORD", "Passwords for the two restricted database roles."],
        ["SESSION_SECRET, OTP_PEPPER, REFERRAL_HMAC_PEPPER, TOTP_PEPPER", "Signing and hashing secrets. Changing them invalidates sessions, pending OTPs and referral lookups."],
        ["FILE_ENCRYPTION_KEY", "Key that encrypts uploaded documents at rest (AES-256-GCM). Defaults to SESSION_SECRET on a pilot install; set it explicitly and keep it with the backups, or a restored database cannot decrypt a single document."],
        ["COMMITTEE_QUORUM", "Committee reviews required before a packet leaves committee review. Default 2, capped by the members assigned to the batch."],
        ["SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM", "Internal mail relay used for OTP and notification email."],
    ]),
    ("note", "If you edit .env after the database volume has been created, changing POSTGRES_PASSWORD will "
             "not change the existing database password and the APIs will fail to connect. Either keep the "
             "original value or recreate the volume deliberately (which erases data)."),
    ("h2", "10.1 Changing the address staff use"),
    ("p", "The origin must match the browser address exactly, including the port. If the portal is opened as "
          "http://10.20.30.40:4000 but PUBLIC_APP_ORIGIN says localhost, the server refuses signed-in "
          "writes with a FOREIGN_ORIGIN error. Fix it with the use-host script (Linux) or by editing both "
          "origin lines in .env and restarting (Windows)."),

    ("h1", "11. Real staff sign-in: enrol authenticators"),
    ("p", "The seeded TOTP secrets are a development convenience. For real users, enrol each person's phone:"),
    ("code", [".\\scripts\\enroll-totp.ps1 admin.hr@ada.gov.in      # prints a QR in the terminal",
              ".\\scripts\\enroll-totp.ps1 director@ada.gov.in --qr C:\\temp\\director.png"]),
    ("p", "The script prints a QR code and an otpauth:// URI, and replaces the account's previous secret. "
          "Show the QR to the person and have them scan it with Microsoft Authenticator, Google "
          "Authenticator or FreeOTP. Do not send the secret by email."),
    ("p", "A staff member whose account has no authenticator is enrolled at sign-in: after the email "
          "code, the portal shows the QR and asks for the first authenticator code, then stores the "
          "secret. No command line is needed for that person. Rotation is the command above: run it again "
          "and the old secret stops working immediately."),

    ("h1", "12. Turning on production mode"),
    ("p", "Pilot mode exists so the portal can be demonstrated without mail. Before it is used for real "
          "applications, do all of the following:"),
    ("number", [
        "Configure the internal SMTP relay in .env (SMTP_HOST, SMTP_PORT, and credentials if the relay "
        "needs them). Test by requesting a staff OTP and confirming the email arrives.",
        "Set PORTAL_ENV=production and ALLOW_DEV_OTP=false. Restart. The login screen must no longer show "
        "codes; if it does, the value did not take effect.",
        "Decide on HTTPS. If a reverse proxy terminates TLS in front of the portal, set COOKIE_SECURE=true "
        "and use https:// in the two origin values. If the portal stays on plain http inside the intranet, "
        "leave COOKIE_SECURE=false and record that decision.",
        "Enrol a real authenticator for every staff account and disable the demo accounts you do not need.",
        "Confirm the server clock is synchronised (NTP). TOTP codes are time-based; a clock minutes out of "
        "step rejects correct codes.",
        "Take a backup, then rehearse a restore.",
        "Restrict port 4001 to the ADA intranet at the firewall, and keep 5433 on loopback only.",
    ]),
    ("note", "With ALLOW_DEV_OTP=false and no working SMTP_HOST, nobody can sign in. The API returns "
             "EMAIL_UNAVAILABLE with a clear message rather than pretending the code was sent. That is "
             "intentional, but it means SMTP is the first thing to verify after switching modes."),

    ("h1", "13. Network layout"),
    ("p", "For a pilot, one computer running both zones is enough. For the real deployment the zones belong "
          "in different network positions, because the whole point is that students are outside ADA and "
          "staff are inside:"),
    ("bullet", [
        "Intranet host: runs the database, the internal zone on 4001, and the SMTP relay connection.",
        "DMZ host: runs only the public zone container on 4000, with its own copy of .env whose "
        "DATABASE_URL points at the intranet database over a one-way firewall rule.",
        "Only the public zone is reachable from the internet. Port 4001 is never published outside ADA.",
    ]),
    ("p", "If you split the two zones across hosts, change the public container's DATABASE_URL to the "
          "database host and keep the same restricted role (portal_public). The schema and grants are "
          "unchanged; only the connection string differs."),

    ("h1", "14. Troubleshooting"),
    ("table", [
        ["Symptom", "Cause", "What to do"],
        ["docker: command not found", "Docker not installed or not on PATH", "Install Docker, reopen the terminal"],
        ["Cannot connect to the Docker daemon", "Engine not running", "Start Docker Desktop / systemctl start docker"],
        ["port is already allocated", "Another program uses 4000/4001/5433", "Change the *_HOST_PORT values in .env, then start"],
        ["api containers restart repeatedly", "Database password changed after the volume was created", "Restore the original POSTGRES_PASSWORD, or recreate the volume deliberately"],
        ["health check fails, logs show P1001", "API cannot reach db", "docker compose ps; check db is healthy; check .env"],
        ["No OTP shown and no email arrives", "ALLOW_DEV_OTP=false without SMTP", "Configure SMTP, or use pilot mode"],
        ["OTP shown despite ALLOW_DEV_OTP=false", "PORTAL_ENV is still development", "Set PORTAL_ENV=production and restart"],
        ["Sign-in appears to succeed, then you are logged out", "COOKIE_SECURE=true over http", "Set COOKIE_SECURE=false, or serve the portal over HTTPS"],
        ["403 FOREIGN_ORIGIN on save", "Origin in .env differs from the browser address", "Fix PUBLIC_APP_ORIGIN / INTERNAL_APP_ORIGIN, restart"],
        ["Authenticator code always rejected", "Server clock drift", "Enable NTP time sync and try again"],
        ["Too many requests (429)", "OTP rate limit: 5 attempts per 10 minutes per IP", "Wait, or restart the affected API container"],
        ["Referral code rejected", "Used, expired, revoked, or wrong lab/year", "Issue a new code; the error is deliberately generic"],
        ["Browser shows an old page after an upgrade", "Cached assets", "Hard refresh (Ctrl+F5); index.html is served no-store"],
    ]),
    ("p", "For anything else, collect these before asking for help:"),
    ("code", ["docker compose -f docker-compose.intranet.yml ps",
              "docker logs --tail=200 ada-api-internal",
              "docker logs --tail=200 ada-db",
              "# redact .env secrets before sharing"]),

    ("h1", "15. Security checklist"),
    ("bullet", [
        "POSTGRES on 127.0.0.1 only; never publish 5432/5433 to the LAN.",
        "4001 reachable only from the ADA intranet.",
        ".env readable by the service account only, and never copied into a ticket or an email.",
        "ALLOW_DEV_OTP=false and PORTAL_ENV=production for real data.",
        "Every staff account has its own enrolled authenticator; no shared logins.",
        "Backups taken daily, stored off the machine, and one restore rehearsed.",
        "Audit log reviewed - every sign-in, referral redemption, status change, document download and permission denial is in it.",
        "Aadhaar is stored as last four digits plus a keyed hash only; the portal never asks for the full number.",
        "No college accounts exist by design: the signed college letter is uploaded and verified by Admin & HR.",
    ]),

    ("h1", "16. What this version does not do yet"),
    ("p", "Be clear with users about the following before go-live. They are tracked in docs/GAP-ANALYSIS.md:"),
    ("bullet", [
        "Document upload and virus scanning: college letters and certificates are represented as document "
        "records; the file store (MinIO/ClamAV) is not wired yet, so verification currently records a human "
        "decision rather than viewing an uploaded scan.",
        "Resume review, virus-scan quarantine, WAF rules and alerting (milestone M7 hardening).",
        "LDAP/AD single sign-on: email OTP plus TOTP is the v1 login; the LDAP seam is left open.",
        "SMS, payments/stipend, eSign, translations and a mobile app are deliberately out of scope.",
    ]),

    ("h1", "17. Support"),
    ("table", [
        ["Question", "Contact"],
        ["Installation and server", "ADA IT / the person who built this bundle"],
        ["Accounts, roles, referrals", "Admin & HR (the ADMIN_HR account)"],
        ["Policy and eligibility", "Director (Admin & HR)"],
    ]),
    ("p", "Keep this guide, seed-output.txt, SHA256SUMS.txt and a copy of .env with the installation records."),
]


# --------------------------------------------------------------------------
# Plain-text width helper
# --------------------------------------------------------------------------
def wrap_code(line: str, width: int = 96) -> list[str]:
    if len(line) <= width:
        return [line]
    return textwrap.wrap(line, width=width, subsequent_indent="    ", break_long_words=True)


def esc(text: str) -> str:
    """Paragraph()/DOCX treat < and & as markup; the guide uses <host> placeholders."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def flatten_code(lines: list[str]) -> list[str]:
    out: list[str] = []
    for line in lines:
        out.extend(wrap_code(line))
    return out


# --------------------------------------------------------------------------
# Markdown
# --------------------------------------------------------------------------
def to_markdown() -> str:
    md: list[str] = [f"# {TITLE}", f"## {SUBTITLE}", "", f"{VERSION} | {DATE}", ""]
    for kind, value in CONTENT:
        if kind == "p":
            if value == "__TITLE__":
                continue
            md += [value, ""]
        elif kind == "h1":
            md += ["", f"## {value}", ""]
        elif kind == "h2":
            md += ["", f"### {value}", ""]
        elif kind == "h3":
            md += ["", f"#### {value}", ""]
        elif kind == "bullet":
            md += [f"- {item}" for item in value] + [""]
        elif kind == "number":
            md += [f"{i + 1}. {item}" for i, item in enumerate(value)] + [""]
        elif kind == "code":
            md += ["```"] + flatten_code(value) + ["```", ""]
        elif kind == "note":
            md += [f"> {value}", ""]
        elif kind == "table":
            header, *rows = value
            md.append("| " + " | ".join(header) + " |")
            md.append("|" + "|".join(["---"] * len(header)) + "|")
            for row in rows:
                md.append("| " + " | ".join(row) + " |")
            md.append("")
        elif kind == "pagebreak":
            continue
    return "\n".join(md).replace("\n\n\n", "\n\n")


# --------------------------------------------------------------------------
# DOCX
# --------------------------------------------------------------------------
def to_docx(path: str) -> None:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
    from docx.shared import Pt, RGBColor

    doc = Document()
    styles = doc.styles
    styles["Normal"].font.name = "Calibri"
    styles["Normal"].font.size = Pt(10.5)
    for name, size in (("Heading 1", 16), ("Heading 2", 13), ("Heading 3", 11.5)):
        style = styles[name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor(0x0B, 0x2E, 0x4F)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run(TITLE)
    run.bold = True
    run.font.size = Pt(24)
    run.font.color.rgb = RGBColor(0x0B, 0x2E, 0x4F)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub.add_run(SUBTITLE).font.size = Pt(14)

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.add_run(f"{VERSION} | {DATE}\nAeronautical Development Agency, Bengaluru (DRDO)").font.size = Pt(9.5)
    doc.add_paragraph()

    for kind, value in CONTENT:
        if kind == "p":
            if value == "__TITLE__":
                continue
            doc.add_paragraph(value)
        elif kind == "h1":
            doc.add_heading(value, level=1)
        elif kind == "h2":
            doc.add_heading(value, level=2)
        elif kind == "h3":
            doc.add_heading(value, level=3)
        elif kind == "bullet":
            for item in value:
                doc.add_paragraph(item, style="List Bullet")
        elif kind == "number":
            for item in value:
                doc.add_paragraph(item, style="List Number")
        elif kind == "code":
            for line in flatten_code(value):
                para = doc.add_paragraph()
                para.paragraph_format.left_indent = Pt(12)
                para.paragraph_format.space_after = Pt(0)
                run = para.add_run(line if line else " ")
                run.font.name = "Consolas"
                run.font.size = Pt(8.5)
        elif kind == "note":
            para = doc.add_paragraph()
            run = para.add_run("Note: " + value)
            run.italic = True
            run.font.size = Pt(9.5)
        elif kind == "table":
            table = doc.add_table(rows=0, cols=len(value[0]))
            table.style = "Table Grid"
            for r_index, row in enumerate(value):
                cells = table.add_row().cells
                for c_index, text in enumerate(row):
                    cells[c_index].text = text
                    for para in cells[c_index].paragraphs:
                        for run in para.runs:
                            run.font.size = Pt(8.5)
                            if r_index == 0:
                                run.bold = True
            doc.add_paragraph()
        elif kind == "pagebreak":
            doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    doc.save(path)


# --------------------------------------------------------------------------
# PDF
# --------------------------------------------------------------------------
def to_pdf(path: str) -> None:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (BaseDocTemplate, Frame, PageBreak, PageTemplate,
                                    Paragraph, Preformatted, Spacer, Table, TableStyle)

    navy = colors.HexColor("#0B2E4F")
    grey = colors.HexColor("#5B6770")
    light = colors.HexColor("#F2F5F8")

    base = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=base["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13.5, spaceAfter=6)
    h1 = ParagraphStyle("h1x", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=19,
                        textColor=navy, spaceBefore=14, spaceAfter=7)
    h2 = ParagraphStyle("h2x", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=15,
                        textColor=navy, spaceBefore=10, spaceAfter=5)
    code = ParagraphStyle("codex", parent=base["Code"], fontName="Courier", fontSize=7.6, leading=9.6,
                          backColor=light, borderPadding=(5, 6, 5, 6), spaceBefore=4, spaceAfter=8)
    note = ParagraphStyle("notex", parent=body, fontName="Helvetica-Oblique", fontSize=8.8, leading=12,
                          leftIndent=8, borderPadding=(5, 6, 5, 6), backColor=light, textColor=grey)
    title = ParagraphStyle("titlex", parent=base["Title"], fontName="Helvetica-Bold", fontSize=23, leading=28,
                           textColor=navy, alignment=TA_CENTER, spaceAfter=6)
    subtitle = ParagraphStyle("subx", parent=body, fontSize=13, leading=17, alignment=TA_CENTER, spaceAfter=4)
    meta = ParagraphStyle("metax", parent=body, fontSize=9, leading=12, alignment=TA_CENTER, textColor=grey)

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(grey)
        canvas.drawString(18 * mm, 12 * mm, "ADA Internship & Project Work Portal - Intranet Installation Guide")
        canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Page {document.page}")
        canvas.restoreState()

    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=18 * mm, bottomMargin=20 * mm, title=TITLE, author="ADA")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=footer)])

    story = [Paragraph(TITLE, title), Paragraph(SUBTITLE, subtitle),
             Paragraph(f"{VERSION} | {DATE}", meta),
             Paragraph("Aeronautical Development Agency, Bengaluru (DRDO)", meta), Spacer(1, 14)]

    for kind, value in CONTENT:
        if kind == "p":
            if value == "__TITLE__":
                continue
            story.append(Paragraph(esc(value), body))
        elif kind == "h1":
            story.append(Paragraph(esc(value), h1))
        elif kind == "h2":
            story.append(Paragraph(esc(value), h2))
        elif kind == "h3":
            story.append(Paragraph(esc(value), h2))
        elif kind == "bullet":
            for item in value:
                story.append(Paragraph(esc(item), body, bulletText="\u2022"))
        elif kind == "number":
            for index, item in enumerate(value, start=1):
                story.append(Paragraph(esc(item), body, bulletText=f"{index}."))
        elif kind == "code":
            story.append(Preformatted("\n".join(flatten_code(value)), code))
        elif kind == "note":
            story.append(Paragraph("Note: " + esc(value), note))
        elif kind == "table":
            data = [[Paragraph(esc(str(cell)), ParagraphStyle("cell", parent=body, fontSize=8, leading=10.5,
                                                              textColor=navy if row_i == 0 else colors.black))
                     for cell in row] for row_i, row in enumerate(value)]
            col_count = len(value[0])
            widths = [doc.width / col_count] * col_count
            if col_count == 3:
                widths = [doc.width * 0.24, doc.width * 0.30, doc.width * 0.46]
            table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), light),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#C7D0D8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            story.append(table)
            story.append(Spacer(1, 8))
        elif kind == "pagebreak":
            story.append(PageBreak())

    doc.build(story)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    md_path = os.path.join(OUT, "ADA-Portal-Intranet-Installation-Guide.md")
    docx_path = os.path.join(OUT, "ADA-Portal-Intranet-Installation-Guide.docx")
    pdf_path = os.path.join(OUT, "ADA-Portal-Intranet-Installation-Guide.pdf")

    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write(to_markdown())
    to_docx(docx_path)
    to_pdf(pdf_path)

    for file in (md_path, docx_path, pdf_path):
        print(f"{os.path.basename(file)}  {os.path.getsize(file) / 1024:.1f} KB")


if __name__ == "__main__":
    main()

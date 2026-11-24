ADA INTERNSHIP & PROJECT WORK PORTAL
Offline intranet bundle - version 1.0.0
=================================================================

This folder runs the whole portal on a computer with no internet access.
Nothing is downloaded or built here: the two Docker images are inside images/.

WHAT YOU NEED FIRST
  Only Docker, because it is a system service. Node.js, npm, all npm packages,
  both web builds and PostgreSQL 16 are already inside images/ - the PC needs no
  programming language installed and no internet.
  Docker's own installers are in prerequisites/:
    Windows: prerequisites\install-docker-windows.ps1   (Administrator PowerShell)
    Ubuntu : sudo ./prerequisites/install-docker-ubuntu.sh
  See docs/ADA-Portal-Intranet-Installation-Guide.pdf, section 2.2.

QUICK START - WINDOWS
  1. Open PowerShell in this folder.
  2. powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
  3. Open http://localhost:4001 for staff, http://localhost:4000 for students.
  4. Read seed-output.txt for the accounts, TOTP secrets and referral codes.

QUICK START - LINUX
  chmod +x scripts/*.sh
  ./scripts/install.sh

EVERYDAY COMMANDS
  Windows                        Linux
  .\scripts\status.ps1           ./scripts/status.sh
  .\scripts\start.ps1            ./scripts/start.sh
  .\scripts\stop.ps1             ./scripts/stop.sh
  .\scripts\backup.ps1           ./scripts/backup.sh
  .\scripts\enroll-totp.ps1 X    ./scripts/enroll-totp.sh X
  .\scripts\issue-referral.ps1   ./scripts/issue-referral.sh

WHAT THIS VERSION DOES NOT DO YET
  Document uploads and virus scanning, alerting/WAF (milestone M7), LDAP sign-in,
  SMS, payments. See docs/GAP-ANALYSIS.md before promising a go-live date.

FULL INSTRUCTIONS
  docs/ADA-Portal-Intranet-Installation-Guide.pdf   (print this)
  docs/ADA-Portal-Intranet-Installation-Guide.docx  (editable)
  docs/ADA-Portal-Intranet-Installation-Guide.md

Keep .env (created at install) and seed-output.txt with the installation records.
Neither is inside the image tarballs.

ADA INTERNSHIP & PROJECT WORK PORTAL
Offline intranet bundle - version 1.0.0 (build 2026-11-26)
=================================================================

READ THIS FIRST
  This folder is the ONLY thing you copy to the intranet PC.
  Do NOT copy the GitHub source and run "docker compose up" there.
  The source folder asks Docker to download images from the internet, and the
  intranet PC has no internet. That is the error you saw.

  Everything the portal needs is already inside this folder:
    images\ada-portal-api-1.0.0-linux-amd64.tar.gz   the portal (API + both UIs)
    images\postgres-16-alpine-linux-amd64.tar.gz     the database
    docker-compose.intranet.yml                      how to run them
    scripts\install.ps1 / install.sh                 one-command installer

  The images are linux/amd64. Docker Desktop on Windows runs them through WSL2.

-----------------------------------------------------------------
WINDOWS - EXACT STEPS
-----------------------------------------------------------------
  1. Install Docker Desktop if it is not installed yet.
     Installer: prerequisites\windows\DockerDesktopInstaller.exe
     Or, in an Administrator PowerShell:
       powershell -ExecutionPolicy Bypass -File .\prerequisites\install-docker-windows.ps1
     Reboot if the installer asks. Then START Docker Desktop and wait until it
     says "Engine running" (the whale icon stops animating).

  2. Open PowerShell in THIS folder (the folder that contains this README.txt).

  3. Run the installer:
       powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1

     It does four things, all offline:
       - loads both images from images\      (docker load)
       - writes .env with random secrets
       - starts the database and both zones
       - seeds the demo accounts and writes seed-output.txt

  4. Open the portal:
       Students / other labs : http://localhost:4000
       ADA staff             : http://localhost:4001
     Accounts and TOTP secrets are in seed-output.txt. The three student sign-in
     codes are fixed (LRDE-26-DEMU-G239, LRDE-26-DEMU-G476, LRDE-26-DEMP-G58D)
     with their emails - see docs\TESTING.md section 5.

  5. Prove it works, in one command:
       docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools node /app/verify.mjs
     Every line must say PASS. Accounts, test data and what each check proves:
       docs\TESTING.md   (read this before handing the PC over)

  If you want other PCs on the intranet to reach it:
       powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -PortalHost 10.0.0.25
     (use this PC's LAN IP or hostname; Windows Firewall must allow ports 4000/4001)

-----------------------------------------------------------------
LINUX - EXACT STEPS
-----------------------------------------------------------------
  chmod +x scripts/*.sh
  ./scripts/install.sh
  # or, if the portal must be reachable from other PCs:
  PORTAL_HOST=10.0.0.25 ./scripts/install.sh

  Docker itself: sudo ./prerequisites/install-docker-ubuntu.sh

-----------------------------------------------------------------
IF THE SCRIPT IS NOT AN OPTION - RUN IT BY HAND
-----------------------------------------------------------------
  In PowerShell, inside this folder:

    docker load -i .\images\postgres-16-alpine-linux-amd64.tar.gz
    docker load -i .\images\ada-portal-api-1.0.0-linux-amd64.tar.gz
    docker images
      # you must see postgres:16-alpine and ada-portal-api:1.0.0

    docker compose -f docker-compose.intranet.yml up -d
    docker compose -f docker-compose.intranet.yml ps
    docker compose -f docker-compose.intranet.yml --profile tools run --rm tools npm run db:seed -w @ada/api

  Then open http://localhost:4000 and http://localhost:4001.

-----------------------------------------------------------------
TROUBLESHOOTING - READ THE EXACT MESSAGE
-----------------------------------------------------------------
  "pull access denied for postgres" / "failed to resolve reference" /
  "dial tcp ... no such host" / "TLS handshake timeout"
      The images were not loaded. Docker is trying the internet.
      Fix: run the two "docker load" commands above. They take 1-3 minutes and
      print "Loaded image: ...". Then run compose again.

  "no matching manifest for windows/amd64"
      You are using the GitHub source's docker-compose.yml, not this bundle.
      Fix: always pass -f docker-compose.intranet.yml from this folder.

  "port is already allocated"
      Another program uses 4000, 4001 or 5433.
      Fix: edit .env and set PUBLIC_HOST_PORT=8080 (etc.), then
           docker compose -f docker-compose.intranet.yml up -d

  "The Docker engine is not running"
      Start Docker Desktop and wait for "Engine running", then re-run.

  Docker Desktop will not start on Windows
      It needs WSL2 and virtualization. In an Administrator PowerShell:
        wsl --install
        wsl --update
      Reboot, enable Virtualization (VT-x/AMD-V) in BIOS if still failing.

  Everything looks up but the browser shows nothing
      Wait 1-2 minutes on the first start (database init + migrations).
      Check: docker compose -f docker-compose.intranet.yml ps
      Logs : docker compose -f docker-compose.intranet.yml logs --tail=80

  "image not found locally" after this update
      The compose file is set to pull_policy: never on purpose: it must fail
      fast instead of hanging on the internet. Load the images, then retry.

-----------------------------------------------------------------
EVERYDAY COMMANDS
-----------------------------------------------------------------
  Windows                          Linux
  .\scripts\status.ps1             ./scripts/status.sh
  .\scripts\start.ps1              ./scripts/start.sh
  .\scripts\stop.ps1               ./scripts/stop.sh
  .\scripts\backup.ps1             ./scripts/backup.sh
  .\scripts\enroll-totp.ps1 X      ./scripts/enroll-totp.sh X
  .\scripts\issue-referral.ps1     ./scripts/issue-referral.sh

-----------------------------------------------------------------
WHAT THIS VERSION DOES NOT DO YET
-----------------------------------------------------------------
  Document uploads and virus scanning, alerting/WAF (milestone M7), LDAP sign-in,
  SMS, payments. See docs/GAP-ANALYSIS.md before promising a go-live date.

FULL INSTRUCTIONS
  docs/TESTING.md                                   (run, test, credentials)
  docs/ADA-Portal-Intranet-Installation-Guide.pdf   (print this)
  docs/ADA-Portal-Intranet-Installation-Guide.docx  (editable)
  docs/ADA-Portal-Intranet-Installation-Guide.md

Keep .env (created at install) and seed-output.txt with the installation records.
Neither is inside the image tarballs.

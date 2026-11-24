# ADA Internship Portal - first-time install on the intranet PC (Windows / PowerShell 5+).
#
#   .\scripts\install.ps1
#   .\scripts\install.ps1 -PortalHost internship.ada.internal
#   .\scripts\install.ps1 -NoSeed
#
# Run from an elevated PowerShell only if Docker itself needs elevation; the portal does not.
param(
  [string]$PortalHost = "localhost",
  [switch]$NoSeed
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path "$PSScriptRoot\..")

function Say($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail @"
Docker is not installed yet. Everything else is already inside this folder.
Run this once in an Administrator PowerShell, reboot, then try again:
  powershell -ExecutionPolicy Bypass -File .\prerequisites\install-docker-windows.ps1
"@
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "The Docker engine is not running. Start Docker Desktop and run this again." }
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Fail "The docker compose plugin is missing." }

Say "Loading images from images\ (no internet needed)"
$tarballs = @(Get-ChildItem -Path "images" -Filter "*.tar*" -ErrorAction SilentlyContinue)
if ($tarballs.Count -eq 0) { Fail "No image tarballs in images\. Copy the whole bundle folder." }
foreach ($t in $tarballs) {
  Write-Host "  loading $($t.Name)"
  docker load -i $t.FullName *> $null
  if ($LASTEXITCODE -ne 0) { Fail "docker load failed for $($t.Name)" }
}

function New-Secret {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([BitConverter]::ToString($bytes) -replace "-", "").ToLower()
}

if (-not (Test-Path ".env")) {
  Say "Writing .env with random secrets"
  $envBody = @"
PORTAL_ENV=development
ALLOW_DEV_OTP=true
LOG_LEVEL=info
COOKIE_SECURE=false

PUBLIC_APP_ORIGIN=http://$PortalHost`:4000
INTERNAL_APP_ORIGIN=http://$PortalHost`:4001
PUBLIC_HOST_PORT=4000
INTERNAL_HOST_PORT=4001
POSTGRES_HOST_PORT=5433

POSTGRES_DB=ada_portal
POSTGRES_USER=portal_owner
POSTGRES_PASSWORD=$(New-Secret)
PORTAL_PUBLIC_DB_PASSWORD=$(New-Secret)
PORTAL_INTERNAL_DB_PASSWORD=$(New-Secret)

SESSION_SECRET=$(New-Secret)
OTP_PEPPER=$(New-Secret)
REFERRAL_HMAC_PEPPER=$(New-Secret)
TOTP_PEPPER=$(New-Secret)

SMTP_FROM="ADA Internship Portal <no-reply@ada.gov.in>"
"@
  Set-Content -Path ".env" -Value $envBody -Encoding ASCII
  Write-Host "  .env written (keep this file; it holds the database password and signing secrets)"
} else {
  Say ".env already exists - keeping it (delete it to regenerate secrets)"
}

Say "Starting the stack"
docker compose -f docker-compose.intranet.yml up -d
if ($LASTEXITCODE -ne 0) { Fail "docker compose up failed." }

Say "Waiting for both zones to become healthy"
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $p = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:4000/api/health" -TimeoutSec 3
    $n = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:4001/api/health" -TimeoutSec 3
    if ($p.StatusCode -eq 200 -and $n.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if (-not $ok) {
  docker compose -f docker-compose.intranet.yml ps
  Fail "The API did not become healthy. Run: docker compose -f docker-compose.intranet.yml logs --tail=80"
}

if (-not $NoSeed) {
  Say "Seeding accounts (safe to re-run)"
  docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools npm run db:seed -w @ada/api |
    Tee-Object -FilePath "seed-output.txt"
  if ($LASTEXITCODE -ne 0) { Fail "Seeding failed. Inspect the output above." }
}

Say "Installed"
Write-Host "  Public zone (students/other labs) : http://localhost:4000"
Write-Host "  Internal zone (ADA staff)         : http://localhost:4001"
Write-Host "  From another PC on the intranet   : http://$PortalHost`:4000  (re-run with -PortalHost <name|ip>)"
Write-Host "`n  Next: read docs\ADA-Portal-Intranet-Installation-Guide.docx"
Write-Host "  Enrol a real authenticator: .\scripts\enroll-totp.ps1 admin.hr@ada.gov.in"

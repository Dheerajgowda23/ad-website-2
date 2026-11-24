# Enrol or rotate a staff authenticator. Usage: .\scripts\enroll-totp.ps1 someone@ada.gov.in
param([Parameter(Mandatory = $true)][string]$Email)
Set-Location (Resolve-Path "$PSScriptRoot\..")
docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools `
  npm run totp:enroll -w @ada/api -- $Email

# Issue a referral code. Usage: .\scripts\issue-referral.ps1 -Level UG -Name "Student" -Email student@college.edu.in
param(
  [ValidateSet("UG", "PG")][string]$Level = "UG",
  [string]$Name = "Student Candidate",
  [string]$Email = "student@college.edu.in"
)
Set-Location (Resolve-Path "$PSScriptRoot\..")
docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools `
  npm run issue-code -w @ada/api -- $Level $Name $Email

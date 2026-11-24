# Restore a dump made by backup.ps1.
# Copies the dump into the database container first, so this works on Windows
# PowerShell 5.1 as well as PowerShell 7 (no binary pipeline through docker exec).
param([Parameter(Mandatory = $true)][string]$Dump)
Set-Location (Resolve-Path "$PSScriptRoot\..")

if (-not (Test-Path $Dump)) { Write-Host "No such file: $Dump" -ForegroundColor Red; exit 2 }
if ((Read-Host "This replaces the current database. Type RESTORE to continue") -ne "RESTORE") {
  Write-Host "Aborted."; exit 1
}

$envMap = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)=(.*)$') { $envMap[$matches[1]] = $matches[2] }
}

docker cp $Dump ada-db:/tmp/ada-restore.dump
docker exec -e "PGPASSWORD=$($envMap['POSTGRES_PASSWORD'])" ada-db `
  pg_restore -U "$($envMap['POSTGRES_USER'])" -d "$($envMap['POSTGRES_DB'])" --clean --if-exists /tmp/ada-restore.dump
docker exec ada-db rm -f /tmp/ada-restore.dump

Write-Host "Restore finished. Restart the APIs: .\scripts\start.ps1"

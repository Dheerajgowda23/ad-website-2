# Dump the database to backups\ada-<timestamp>.dump
Set-Location (Resolve-Path "$PSScriptRoot\..")
New-Item -ItemType Directory -Force -Path backups | Out-Null
$envMap = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)=(.*)$') { $envMap[$matches[1]] = $matches[2] }
}
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = "backups\ada-$stamp.dump"
docker exec -e "PGPASSWORD=$($envMap['POSTGRES_PASSWORD'])" ada-db `
  pg_dump -U "$($envMap['POSTGRES_USER'])" -d "$($envMap['POSTGRES_DB'])" -Fc > $file
Copy-Item .env "backups\env-$stamp.bak"
# Uploaded documents live on a Docker volume, not in the database.
docker cp ada-api-public:/app/data/files "backups\files-$stamp" 2>$null
Write-Host "Backup written: $file, backups\env-$stamp.bak, backups\files-$stamp (documents)"

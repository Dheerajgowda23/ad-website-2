# Start the portal (after the first install).
Set-Location (Resolve-Path "$PSScriptRoot\..")
docker compose -f docker-compose.intranet.yml up -d
docker compose -f docker-compose.intranet.yml ps

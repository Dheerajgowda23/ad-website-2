# Stop the portal. Data in the ada-portal_ada_pgdata volume is kept.
Set-Location (Resolve-Path "$PSScriptRoot\..")
docker compose -f docker-compose.intranet.yml stop

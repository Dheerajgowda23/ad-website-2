#!/usr/bin/env bash
# Dump the database to backups/ada-<timestamp>.dump (custom format, restorable).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
# shellcheck disable=SC1091
set -a; . ./.env; set +a
stamp=$(date +%Y%m%d-%H%M%S)
file="backups/ada-${stamp}.dump"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" ada-db \
  pg_dump -U "${POSTGRES_USER:-portal_owner}" -d "${POSTGRES_DB:-ada_portal}" -Fc > "$file"
cp .env "backups/env-${stamp}.bak"

# Uploaded documents live on a Docker volume, not in the database: back them up too.
docker cp ada-api-public:/app/data/files "backups/files-${stamp}" 2>/dev/null \
  || echo "  (no uploaded documents yet)"

chmod 600 "backups/env-${stamp}.bak" "$file" 2>/dev/null || true
echo "Backup written: $file"
echo "Documents:      backups/files-${stamp} (if any)"
echo "Also saved .env (the database password and secrets are needed to restore)."

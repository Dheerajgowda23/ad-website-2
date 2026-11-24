#!/usr/bin/env bash
# Restore a dump made by backup.sh. Usage: ./scripts/restore.sh backups/ada-YYYYmmdd-HHMMSS.dump
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -eq 1 ] || { echo "Usage: $0 <dump-file>" >&2; exit 2; }
[ -f "$1" ] || { echo "No such file: $1" >&2; exit 2; }
# shellcheck disable=SC1091
set -a; . ./.env; set +a
echo "This replaces the current database with $1."
read -r -p "Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Aborted."; exit 1; }
docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" ada-db \
  pg_restore -U "${POSTGRES_USER:-portal_owner}" -d "${POSTGRES_DB:-ada_portal}" --clean --if-exists < "$1"
echo "Restore finished. Restart the APIs: ./scripts/start.sh"

#!/usr/bin/env bash
# Show container status and the health of both zones.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
set +a
PUB="${PUBLIC_HOST_PORT:-4000}"
INT="${INTERNAL_HOST_PORT:-4001}"
docker compose -f docker-compose.intranet.yml ps
echo
echo -n "public  :$PUB -> "; curl -fsS "http://127.0.0.1:$PUB/api/health" || echo "no answer"
echo
echo -n "internal:$INT -> "; curl -fsS "http://127.0.0.1:$INT/api/health" || echo "no answer"
echo

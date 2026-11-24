#!/usr/bin/env bash
# Stop the portal. Data lives in the ada-portal_ada_pgdata volume and is kept.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f docker-compose.intranet.yml stop

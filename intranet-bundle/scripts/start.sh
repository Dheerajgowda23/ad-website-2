#!/usr/bin/env bash
# Start the portal (after the first install).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f docker-compose.intranet.yml up -d
docker compose -f docker-compose.intranet.yml ps

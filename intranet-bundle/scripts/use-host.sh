#!/usr/bin/env bash
# Point the portal at the host name or IP staff will use. Usage: ./scripts/use-host.sh internship.ada.internal
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -eq 1 ] || { echo "Usage: $0 <host-or-ip>" >&2; exit 2; }
HOST="$1"
sed -i.bak -E "s#^PUBLIC_APP_ORIGIN=.*#PUBLIC_APP_ORIGIN=http://${HOST}:4000#; s#^INTERNAL_APP_ORIGIN=.*#INTERNAL_APP_ORIGIN=http://${HOST}:4001#" .env
rm -f .env.bak
docker compose -f docker-compose.intranet.yml up -d
echo "Origins now use http://${HOST}:4000 and http://${HOST}:4001. Log in again (sessions are per origin)."

#!/usr/bin/env bash
# Enrol or rotate a staff authenticator. Usage: ./scripts/enroll-totp.sh someone@ada.gov.in
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -eq 1 ] || { echo "Usage: $0 <staff-email>" >&2; exit 2; }
docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools \
  npm run totp:enroll -w @ada/api -- "$1"

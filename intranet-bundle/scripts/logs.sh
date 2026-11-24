#!/usr/bin/env bash
# Follow the API logs. Usage: ./scripts/logs.sh [public|internal|db]
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-internal}" in
  public) docker logs -f --tail=200 ada-api-public ;;
  internal) docker logs -f --tail=200 ada-api-internal ;;
  db) docker logs -f --tail=200 ada-db ;;
  *) echo "Usage: $0 [public|internal|db]" >&2; exit 2 ;;
esac

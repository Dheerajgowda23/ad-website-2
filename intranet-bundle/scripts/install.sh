#!/usr/bin/env bash
# ADA Internship Portal - first-time install on the intranet PC (Linux / macOS).
#
#   ./scripts/install.sh                       # localhost
#   PORTAL_HOST=internship.ada.internal ./scripts/install.sh
#   ./scripts/install.sh --no-seed             # bring up an empty database
#
# It loads the two images from images/, writes .env with random secrets, starts the
# stack, waits for both zones, and seeds the accounts on a fresh database.
set -euo pipefail

cd "$(dirname "$0")/.."
BUNDLE_DIR="$(pwd)"
COMPOSE=(docker compose -f docker-compose.intranet.yml)
SEED=1
for arg in "$@"; do
  case "$arg" in
    --no-seed) SEED=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || fail "Docker is not installed yet.\n  Everything else is inside this folder; only the container runtime is missing.\n  Run:  sudo ./prerequisites/install-docker-ubuntu.sh\n  (Windows: right-click PowerShell as Administrator and run\n   powershell -ExecutionPolicy Bypass -File .\\prerequisites\\install-docker-windows.ps1 )"
docker info >/dev/null 2>&1 || fail "The Docker daemon is not running. Start Docker and run this again."
docker compose version >/dev/null 2>&1 || fail "The docker compose plugin is missing. Install docker-compose-plugin."

say "Loading images from images/ (no internet needed)"
shopt -s nullglob
tarballs=(images/*.tar.gz images/*.tar)
[ ${#tarballs[@]} -gt 0 ] || fail "No image tarballs in images/. Copy the whole bundle folder."
for tarball in "${tarballs[@]}"; do
  echo "  loading $tarball"
  docker load -i "$tarball" >/dev/null
done

say "Verifying the images are present locally"
docker image inspect postgres:16-alpine >/dev/null 2>&1 \
  || fail "postgres:16-alpine was not loaded. Copy the whole bundle, including images/*.tar.gz, then run this again."
docker images --format '{{.Repository}}:{{.Tag}}' | grep -q '^ada-portal-api:' \
  || fail "ada-portal-api was not loaded. Copy the whole bundle, including images/*.tar.gz, then run this again."
echo "  images ready"

if [ ! -f .env ]; then
  say "Writing .env with random secrets"
  secret() { openssl rand -hex 24 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '\n=+/'; }
  HOST="${PORTAL_HOST:-localhost}"
  cat > .env <<EOF
PORTAL_ENV=development
ALLOW_DEV_OTP=true
LOG_LEVEL=info
COOKIE_SECURE=false

PUBLIC_APP_ORIGIN=http://${HOST}:4000
INTERNAL_APP_ORIGIN=http://${HOST}:4001
PUBLIC_HOST_PORT=4000
INTERNAL_HOST_PORT=4001
POSTGRES_HOST_PORT=5433

POSTGRES_DB=ada_portal
POSTGRES_USER=portal_owner
POSTGRES_PASSWORD=$(secret)
PORTAL_PUBLIC_DB_PASSWORD=$(secret)
PORTAL_INTERNAL_DB_PASSWORD=$(secret)

SESSION_SECRET=$(secret)
OTP_PEPPER=$(secret)
REFERRAL_HMAC_PEPPER=$(secret)
TOTP_PEPPER=$(secret)

SMTP_FROM="ADA Internship Portal <no-reply@ada.gov.in>"
EOF
  chmod 600 .env
else
  say ".env already exists - keeping it (delete it to regenerate secrets)"
fi

say "Starting the stack"
# Read the ports and origins from .env so this script and the stack never disagree.
set -a
# shellcheck disable=SC1091
. ./.env
set +a
"${COMPOSE[@]}" up -d

say "Waiting for both zones to become healthy"
for i in $(seq 1 60); do
  public_ok=$(curl -fsS http://127.0.0.1:${PUBLIC_HOST_PORT:-4000}/api/health >/dev/null 2>&1 && echo yes || echo no)
  internal_ok=$(curl -fsS http://127.0.0.1:${INTERNAL_HOST_PORT:-4001}/api/health >/dev/null 2>&1 && echo yes || echo no)
  if [ "$public_ok" = yes ] && [ "$internal_ok" = yes ]; then break; fi
  sleep 2
  if [ "$i" = 60 ]; then
    "${COMPOSE[@]}" ps
    fail "The API did not become healthy. Run: docker compose -f docker-compose.intranet.yml logs --tail=80"
  fi
done

if [ "$SEED" = 1 ]; then
  say "Seeding accounts (safe to re-run; existing rows are updated, not duplicated)"
  "${COMPOSE[@]}" --profile tools run --rm -T tools npm run db:seed -w @ada/api | tee seed-output.txt \
    || fail "Seeding failed. Inspect the output above."
  echo
  echo "Seeded credentials and the three one-time referral codes are also saved in seed-output.txt."
fi

say "Installed"
# hostname -I is Linux-only; fall back to the macOS interface address, then to blank.
IP="$(hostname -I 2>/dev/null | awk '{print $1}')" || IP="$(ipconfig getifaddr en0 2>/dev/null)" || IP=""
echo "  Public zone (students/other labs) : http://localhost:${PUBLIC_HOST_PORT:-4000}"
echo "  Internal zone (ADA staff)         : http://localhost:${INTERNAL_HOST_PORT:-4001}"
if [ -n "${IP:-}" ]; then
  echo "  From another PC on the intranet   : http://${IP}:${PUBLIC_HOST_PORT:-4000}  (run scripts/use-host.sh ${IP} first)"
fi
echo
echo "  Next: read docs/ADA-Portal-Intranet-Installation-Guide.pdf"
echo "  Enrol a real authenticator: ./scripts/enroll-totp.sh admin.hr@ada.gov.in"

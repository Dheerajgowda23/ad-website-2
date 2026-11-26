#!/usr/bin/env bash
# Build the offline intranet bundle from this checkout.
#
#   ./scripts/build-intranet-bundle.sh                 # amd64, version 1.0.0
#   ./scripts/build-intranet-bundle.sh 1.1.0 amd64
#
# Produces intranet-bundle/images/*.tar.gz plus docs, scripts and checksums.
# The intranet PC needs only Docker; nothing here is downloaded there.
set -euo pipefail

cd "$(dirname "$0")/.."
VERSION="${1:-1.0.0}"
PLATFORM="${2:-linux/amd64}"
BUNDLE="intranet-bundle"
IMAGE="ada-portal-api:${VERSION}"

say() { printf '\n==> %s\n' "$*"; }

say "Checking the offline prerequisites (Docker installers)"
./scripts/fetch-prerequisites.sh

say "Building ${IMAGE} for ${PLATFORM}"
docker buildx build \
  --platform "$PLATFORM" \
  -f Dockerfile.api \
  -t "$IMAGE" \
  --load .

say "Pulling postgres:16-alpine for ${PLATFORM}"
docker pull --platform "$PLATFORM" postgres:16-alpine

say "Saving images"
mkdir -p "$BUNDLE/images"
docker save "$IMAGE" | gzip -9 > "$BUNDLE/images/ada-portal-api-${VERSION}-$(echo "$PLATFORM" | tr '/' '-').tar.gz"
docker save postgres:16-alpine | gzip -9 > "$BUNDLE/images/postgres-16-alpine-$(echo "$PLATFORM" | tr '/' '-').tar.gz"

say "Copying deployment files"
mkdir -p "$BUNDLE/db" "$BUNDLE/docs" "$BUNDLE/scripts"
cp db/grants.sql db/init-roles.sh "$BUNDLE/db/"
chmod +x "$BUNDLE/db/init-roles.sh"

say "Archiving the application source (for audit; rebuilding needs internet)"
mkdir -p "$BUNDLE/source"
tar -czf "$BUNDLE/source/ada-portal-source-${VERSION}.tar.gz" \
  --exclude='./node_modules' --exclude='*/node_modules' \
  --exclude='./.git' --exclude='./.tools' --exclude='./.cloud-attachments' \
  --exclude='./.freebuff' --exclude='./screenshots' --exclude='./intranet-bundle' \
  --exclude='./.env' --exclude='./dist' --exclude='*/dist' \
  .

say "Rendering the installation guide (Markdown, DOCX, PDF)"
if [ -x .tools/venv/bin/python ]; then
  .tools/venv/bin/python scripts/build-intranet-docs.py
else
  echo "  .tools/venv missing - install python-docx and reportlab, or copy the docs in by hand" >&2
fi

say "Writing checksums for the files that ship"
# Only what the zip contains. prerequisites/ and source/ stay on the build machine,
# so checksumming them would make "shasum -c" fail on the intranet PC.
(
  cd "$BUNDLE"
  find . -type f \
    ! -path './prerequisites/*' ! -path './source/*' \
    ! -name 'SHA256SUMS.txt' ! -name '.env' ! -name 'seed-output.txt' ! -name '.DS_Store' \
    -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS.txt
)

say "Building the release zip"
ZIP="ada-portal-offline-${VERSION}.zip"
rm -f "$ZIP"
( cd "$BUNDLE" && zip -r -X -q "$(cd .. && pwd)/$ZIP" \
    README.txt SHA256SUMS.txt .env.example db docker-compose.intranet.yml docs images scripts )

say "Bundle ready: $BUNDLE/ and $ZIP"
du -sh "$BUNDLE"
ls -lh "$BUNDLE/images" "$ZIP"
echo
echo "Upload $ZIP to the release, then copy the same zip to the intranet PC and run"
echo "scripts/install.ps1 (Windows) or scripts/install.sh (Linux). Image tag: ADA_API_TAG=${VERSION}"
echo "Check the install with: docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools node /app/verify.mjs"

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

say "Writing checksums"
(
  cd "$BUNDLE"
  { shasum -a 256 images/*.tar.gz
    find prerequisites/windows prerequisites/linux source -type f \( -name '*.exe' -o -name '*.msi' -o -name '*.deb' -o -name '*.tar.gz' \) -print0 \
      | xargs -0 shasum -a 256
  } > SHA256SUMS.txt
)

say "Bundle ready: $BUNDLE/"
du -sh "$BUNDLE"
ls -lh "$BUNDLE/images"
echo
echo "Copy the whole $BUNDLE folder to the intranet PC and run scripts/install.ps1 (Windows)"
echo "or scripts/install.sh (Linux). Image tag to set there: ADA_IMAGE_TAG=${VERSION}"

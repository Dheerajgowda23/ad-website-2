#!/usr/bin/env bash
# Install Docker Engine on an offline Ubuntu PC from the .deb files in this folder.
#
#   sudo ./prerequisites/install-docker-ubuntu.sh
#
# Supported: Ubuntu 22.04 (jammy) and 24.04 (noble), x86-64.
# Docker Engine is free software (Apache-2.0), unlike Docker Desktop.
set -euo pipefail

cd "$(dirname "$0")"

say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Run with sudo: sudo ./prerequisites/install-docker-ubuntu.sh"

# shellcheck disable=SC1091
. /etc/os-release
case "${VERSION_CODENAME:-}" in
  jammy|noble) PKG_DIR="linux/ubuntu-${VERSION_CODENAME}" ;;
  *) fail "This folder has packages for Ubuntu 22.04 and 24.04 only (found: ${PRETTY_NAME:-unknown}). See docs/ for the RHEL note." ;;
esac

[ -d "$PKG_DIR" ] || fail "$PKG_DIR is missing. Copy the whole bundle folder."

say "Installing Docker Engine from $PKG_DIR"
# dpkg -i is enough for these packages on a stock Ubuntu; the second pass fixes
# ordering if dpkg complains about dependencies between them.
dpkg -i "$PKG_DIR"/*.deb || dpkg -i "$PKG_DIR"/*.deb

say "Enabling the service"
systemctl enable --now docker

say "Allowing non-root use"
TARGET_USER="${SUDO_USER:-}"
if [ -n "$TARGET_USER" ] && [ "$TARGET_USER" != "root" ]; then
  usermod -aG docker "$TARGET_USER"
  echo "  added $TARGET_USER to the docker group (log out and back in)"
fi

say "Checking"
docker --version
docker compose version
docker info >/dev/null && echo "  docker engine is running"

cat <<'EOT'

Docker is installed. Now run, from the bundle folder:
  ./scripts/install.sh

If dpkg reported missing dependencies, they were not in this folder. On an offline
PC install them from your Ubuntu installation media (apt-cdrom), or use a PC that
already has Docker.
EOT

#!/usr/bin/env bash
# Download the runtime installers that go into the offline bundle.
#
# Run this on a machine WITH internet when preparing a bundle. The intranet PC
# never runs this file - the downloaded installers travel inside the folder.
#
#   ./scripts/fetch-prerequisites.sh
#
# Idempotent: existing files are kept.
set -euo pipefail

cd "$(dirname "$0")/.."
BASE="intranet-bundle/prerequisites"
mkdir -p "$BASE/windows" "$BASE/linux"

say() { printf '\n==> %s\n' "$*"; }

fetch() {
  local url="$1" dest="$2"
  if [ -s "$dest" ]; then
    echo "  exists  $dest"
    return
  fi
  echo "  fetch   $dest"
  curl -fL --retry 3 --connect-timeout 20 -o "$dest" "$url"
}

say "Windows: Docker Desktop + WSL 2 kernel"
fetch "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" \
  "$BASE/windows/DockerDesktopInstaller.exe"
fetch "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi" \
  "$BASE/windows/wsl_update_x64.msi"

say "Linux: Docker Engine packages (Ubuntu 22.04 and 24.04, x86-64)"
for distro in jammy noble; do
  dir="$BASE/linux/ubuntu-$distro"
  mkdir -p "$dir"
  pool="https://download.docker.com/linux/ubuntu/dists/$distro/pool/stable/amd64/"
  listing=$(curl -fsSL "$pool")
  for pkg in "containerd.io" "docker-ce" "docker-ce-cli" "docker-buildx-plugin" "docker-compose-plugin"; do
    pattern=$(printf '%s' "$pkg" | sed 's/\./\\./g')
    file=$(printf '%s\n' "$listing" | grep -oE "${pattern}_[^\"]+_amd64\.deb" | sort -V | tail -1)
    [ -n "$file" ] || { echo "  MISSING $pkg ($distro)" >&2; exit 1; }
    fetch "$pool$file" "$dir/$file"
  done
done

say "Done"
du -sh "$BASE"

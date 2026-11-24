PREREQUISITES - what to install on a bare PC
=================================================================

The portal itself needs NOTHING else installed. Node.js, npm, every JavaScript
package, both web builds and PostgreSQL 16 are inside images/ and are loaded into
Docker. This folder exists because Docker does not ship inside a project folder:
it is a system service and needs a one-time install.

WHAT IS HERE
  windows/DockerDesktopInstaller.exe   Docker Desktop for Windows (x86-64)
  windows/wsl_update_x64.msi           WSL 2 kernel update, needed on older Windows 10
  linux/ubuntu-jammy/                  Docker Engine .debs for Ubuntu 22.04
  linux/ubuntu-noble/                  Docker Engine .debs for Ubuntu 24.04
  install-docker-windows.ps1           silent install + WSL 2 checks (Administrator)
  install-docker-ubuntu.sh             dpkg install + service + docker group (sudo)

WINDOWS
  1. Right-click PowerShell -> Run as administrator
  2. cd to the bundle folder
  3. powershell -ExecutionPolicy Bypass -File .\prerequisites\install-docker-windows.ps1
  4. Reboot, start Docker Desktop, wait for "Engine running"
  5. powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1

Requires: Windows 10 64-bit build 19044+ or Windows 11, virtualisation enabled in
the BIOS/UEFI, and Administrator rights.

UBUNTU / DEBIAN
  sudo ./prerequisites/install-docker-ubuntu.sh
  ./scripts/install.sh        # log out and back in first, for the docker group

DOCKER DESKTOP LICENSING
  Docker Desktop is free for personal use, education and small businesses. Larger
  organisations (250+ employees or more than US$10M revenue) need a paid Docker
  subscription. Docker Engine on Linux is free (Apache-2.0). If Docker Desktop is
  not licensed for your organisation, run the bundle on a Linux PC - the same
  images and the same scripts apply.

RHEL / ROCKY / OTHER LINUX
  Not bundled. Install Docker Engine + the compose plugin from your OS media or an
  internal repository, then run ./scripts/install.sh. The portal itself is
  unaffected: it only needs a working `docker` and `docker compose`.

AIR-GAPPED VALIDATION
  Everything above is already inside this folder; the installers never contact the
  internet. Verify the copy with SHA256SUMS.txt in the bundle root.

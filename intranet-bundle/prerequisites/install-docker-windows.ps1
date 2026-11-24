# Install Docker on a Windows PC with no internet, from the files in this folder.
#
#   Right-click PowerShell -> "Run as Administrator", then:
#     cd C:\ada-portal-intranet
#     powershell -ExecutionPolicy Bypass -File .\prerequisites\install-docker-windows.ps1
#
# What it does:
#   1. checks it is running elevated
#   2. enables the WSL 2 / Virtual Machine Platform Windows features if needed
#   3. installs the WSL 2 kernel update (wsl_update_x64.msi) if it is missing
#   4. installs Docker Desktop silently from DockerDesktopInstaller.exe
#   5. adds the current user to the docker-users group
#
# It does NOT reboot. Windows needs a reboot after step 2/4; run this again after
# rebooting if it stops at that point - it is safe to re-run.

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot

function Say($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Fail "Run this in an Administrator PowerShell (right-click -> Run as administrator)."
}

$desktopExe = Join-Path $here "windows\DockerDesktopInstaller.exe"
$wslMsi = Join-Path $here "windows\wsl_update_x64.msi"
if (-not (Test-Path $desktopExe)) { Fail "windows\DockerDesktopInstaller.exe is missing. Copy the whole bundle folder." }

Say "Checking Windows features (WSL 2 backend)"
$features = @("Microsoft-Windows-Subsystem-Linux", "VirtualMachinePlatform")
foreach ($feature in $features) {
  $state = (Get-WindowsOptionalFeature -Online -FeatureName $feature -ErrorAction SilentlyContinue).State
  if ($state -ne "Enabled") {
    Write-Host "  enabling $feature"
    Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart | Out-Null
  } else {
    Write-Host "  $feature already enabled"
  }
}

Say "Checking the WSL 2 kernel"
$wsl = Get-Command wsl -ErrorAction SilentlyContinue
if ($wsl) {
  wsl --status *> $null
  if ($LASTEXITCODE -ne 0 -and (Test-Path $wslMsi)) {
    Write-Host "  installing wsl_update_x64.msi"
    Start-Process -Wait -FilePath "msiexec.exe" -ArgumentList @("/i", "`"$wslMsi`"", "/qn", "/norestart")
  } else {
    Write-Host "  WSL is present"
  }
} elseif (Test-Path $wslMsi) {
  Write-Host "  WSL command not found; installing the kernel update"
  Start-Process -Wait -FilePath "msiexec.exe" -ArgumentList @("/i", "`"$wslMsi`"", "/qn", "/norestart")
}

Say "Installing Docker Desktop (silent)"
Write-Host "  this takes a few minutes; the screen may flicker"
$process = Start-Process -Wait -PassThru -FilePath $desktopExe -ArgumentList @("install", "--quiet", "--accept-license")
if ($process.ExitCode -ne 0) {
  Fail "Docker Desktop installer exited with code $($process.ExitCode). Run it by hand to see the message."
}

Say "Adding $env:USERNAME to the docker-users group"
try {
  Add-LocalGroupMember -Group "docker-users" -Member $env:USERNAME -ErrorAction Stop
  Write-Host "  added (sign out and back in for it to apply)"
} catch {
  Write-Host "  already a member, or the group does not exist yet"
}

Write-Host ""
Write-Host "Docker Desktop is installed." -ForegroundColor Green
Write-Host "  1. Reboot Windows (required for WSL 2 and Docker Desktop)."
Write-Host "  2. Start 'Docker Desktop' from the Start menu and wait until it says 'Engine running'."
Write-Host "  3. Then run: powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1"
Write-Host ""
Write-Host "If Docker Desktop cannot be used (licensing or policy), a Linux PC with Docker Engine"
Write-Host "works with the same bundle - see docs/ADA-Portal-Intranet-Installation-Guide.pdf."

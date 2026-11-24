# Container status and health of both zones.
Set-Location (Resolve-Path "$PSScriptRoot\..")
docker compose -f docker-compose.intranet.yml ps
Write-Host ""
foreach ($p in @(4000, 4001)) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$p/api/health" -TimeoutSec 5
    Write-Host "port $p -> $($r.StatusCode) $($r.Content)"
  } catch { Write-Host "port $p -> no answer" -ForegroundColor Yellow }
}

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
Write-Host "Stopping AniStream..." -ForegroundColor Cyan
docker compose down
Write-Host "Stopped." -ForegroundColor Green

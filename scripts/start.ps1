# Start AniStream in the background (Docker). No Cursor or extra terminals needed.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed or not on PATH. Install Docker Desktop first." -ForegroundColor Red
    exit 1
}

try {
    docker info *> $null
} catch {
    Write-Host "Docker Desktop is not running. Start Docker Desktop, then run this again." -ForegroundColor Red
    exit 1
}

Write-Host "Starting AniStream (miruro, consumet, animetsu, gateway, web)..." -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "AniStream is up:" -ForegroundColor Green
Write-Host "  App:     http://localhost"
Write-Host "  Gateway: http://localhost/api/health (via nginx)"
Write-Host ""
Write-Host "Containers restart automatically after reboot if Docker Desktop starts on login."
Write-Host "To stop:  .\scripts\stop.ps1  or  npm run stop"
Write-Host ""

Start-Process "http://localhost"

@echo off
title FocusBlock Extension Builder
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((Get-Content -Path '%~f0' | Select-Object -Skip 6 | Out-String)))"
exit /b %ERRORLEVEL%
rem --- PURE POWERSHELL CODE STARTS BELOW ---

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "    FocusBlock Extension Builder         " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check prerequisites
Write-Host "`n[1/3] Checking tools..." -ForegroundColor Yellow
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "Node found ($(node -v))." -ForegroundColor Green

# 2. Check extension dependencies
Write-Host "`n[2/3] Checking extension dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "$root\apps\extension\node_modules")) {
    Write-Host "Installing extension dependencies..." -ForegroundColor Gray
    Push-Location "$root\apps\extension"
    $null = npm --silent install --no-fund --no-audit
    Pop-Location
} else {
    Write-Host "Extension dependencies present." -ForegroundColor Green
}

# 3. Build Chrome extension
Write-Host "`n[3/3] Building Chrome extension..." -ForegroundColor Yellow
Push-Location "$root\apps\extension"
$buildOutput = & npm --silent run build 2>&1
Pop-Location

$extensionDist = "$root\apps\extension\dist"
if (Test-Path "$extensionDist\manifest.json") {
    Write-Host "`nChrome extension built successfully at:" -ForegroundColor Green
    Write-Host "  $extensionDist" -ForegroundColor Cyan
    Write-Host "`nHow to load in Chrome:" -ForegroundColor Yellow
    Write-Host "  1. Open chrome://extensions in Chrome" -ForegroundColor White
    Write-Host "  2. Turn on 'Developer mode' (top right toggle)" -ForegroundColor White
    Write-Host "  3. Click 'Load unpacked' (top left button)" -ForegroundColor White
    Write-Host "  4. Select the folder: $extensionDist" -ForegroundColor White
} else {
    Write-Host "Warning: Extension build failed." -ForegroundColor Red
    Write-Host ($buildOutput | Out-String) -ForegroundColor Red
}

Write-Host ""
Read-Host "Done! Press Enter to close"

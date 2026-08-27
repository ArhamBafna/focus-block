@echo off
title FocusBlock Desktop Launcher
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((Get-Content -Path '%~f0' | Select-Object -Skip 6 | Out-String)))"
exit /b %ERRORLEVEL%
rem --- PURE POWERSHELL CODE STARTS BELOW ---

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "     FocusBlock Desktop Launcher         " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check prerequisites
Write-Host "`n[1/4] Checking tools..." -ForegroundColor Yellow
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Rust/Cargo is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Rust from https://rustup.rs/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "Tools found (Node $(node -v), Cargo $((cargo --version).Split()[1]))." -ForegroundColor Green

# 2. Check desktop dependencies
Write-Host "`n[2/4] Checking desktop dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "$root\apps\desktop\node_modules")) {
    Write-Host "Installing desktop dependencies..." -ForegroundColor Gray
    Push-Location "$root\apps\desktop"
    $null = npm --silent install --no-fund --no-audit
    Pop-Location
} else {
    Write-Host "Desktop dependencies present." -ForegroundColor Green
}

# 3. Start FocusBlock Service
Write-Host "`n[3/4] Starting FocusBlock Service..." -ForegroundColor Yellow
$serviceProcess = $null
if (Get-Process -Name focus-service -ErrorAction SilentlyContinue) {
    Write-Host "Refreshing background service..." -ForegroundColor Gray
    Stop-Process -Name focus-service -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300
}

Write-Host "Launching FocusBlock Service in background..." -ForegroundColor Gray
$serviceProcess = Start-Process -FilePath "cargo" -ArgumentList "run --bin focus-service -- --console" -WorkingDirectory $root -WindowStyle Minimized -PassThru

$retries = 0
while (-not (Test-Path '\\.\pipe\focusblock') -and $retries -lt 30) {
    Start-Sleep -Milliseconds 500
    $retries++
}
if (Test-Path '\\.\pipe\focusblock') {
    Write-Host "FocusBlock Service ready." -ForegroundColor Green
} else {
    Write-Host "FocusBlock Service starting (compiling in background)..." -ForegroundColor Yellow
}

# 4. Launch Tauri Desktop App
Write-Host "`n[4/4] Starting FocusBlock Desktop App..." -ForegroundColor Yellow
Write-Host "App window will open shortly. Press Ctrl+C in this terminal to stop.`n" -ForegroundColor Gray

Push-Location "$root\apps\desktop"
try {
    npm --silent run tauri dev
} finally {
    Pop-Location
    if ($serviceProcess -and -not $serviceProcess.HasExited) {
        Write-Host "`nStopping FocusBlock Service..." -ForegroundColor Gray
        Stop-Process -Id $serviceProcess.Id -ErrorAction SilentlyContinue
    }
}

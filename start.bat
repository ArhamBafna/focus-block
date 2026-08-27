@echo off
title FocusBlock Launcher
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((Get-Content -Path '%~f0' | Select-Object -Skip 6 | Out-String)))"
exit /b %ERRORLEVEL%
rem --- PURE POWERSHELL CODE STARTS BELOW ---

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "          FocusBlock Launcher            " -ForegroundColor Cyan
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

# 2. Check dependencies
Write-Host "`n[2/4] Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "$root\apps\desktop\node_modules")) {
    Write-Host "Installing desktop dependencies..." -ForegroundColor Gray
    Push-Location "$root\apps\desktop"
    $null = npm --silent install --no-fund --no-audit
    Pop-Location
} else {
    Write-Host "Desktop dependencies present." -ForegroundColor Green
}

if (-not (Test-Path "$root\apps\extension\node_modules")) {
    Write-Host "Installing extension dependencies..." -ForegroundColor Gray
    Push-Location "$root\apps\extension"
    $null = npm --silent install --no-fund --no-audit
    Pop-Location
} else {
    Write-Host "Extension dependencies present." -ForegroundColor Green
}

# 3. Build Chrome extension
Write-Host "`n[3/4] Building Chrome extension..." -ForegroundColor Yellow
Push-Location "$root\apps\extension"
$buildOutput = & npm --silent run build 2>&1
Pop-Location

$extensionDist = "$root\apps\extension\dist"
if (Test-Path "$extensionDist\manifest.json") {
    Write-Host "Chrome extension built successfully at:" -ForegroundColor Green
    Write-Host "  $extensionDist" -ForegroundColor Cyan
    Write-Host "To load in Chrome: open chrome://extensions -> enable 'Developer mode' -> click 'Load unpacked' -> select dist folder." -ForegroundColor Gray
} else {
    Write-Host "Warning: Extension build might have failed." -ForegroundColor Red
    Write-Host ($buildOutput | Out-String) -ForegroundColor Red
}

# 4. Start FocusBlock Service
Write-Host "`n[4/5] Starting FocusBlock Service..." -ForegroundColor Yellow
$serviceProcess = $null
if (Test-Path '\\.\pipe\focusblock') {
    Write-Host "FocusBlock Service is already running." -ForegroundColor Green
} else {
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
}

# 5. Launch Tauri Desktop App
Write-Host "`n[5/5] Starting FocusBlock Desktop App..." -ForegroundColor Yellow
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

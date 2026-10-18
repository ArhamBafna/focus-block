@echo off
title FocusBlock Launcher
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$cliArgs = '%*'; Invoke-Expression (Get-Content -Path '%~f0' | Select-Object -Skip 6 | Out-String)"
exit /b %ERRORLEVEL%
rem --- PURE POWERSHELL CODE STARTS BELOW ---

$ErrorActionPreference = "Stop"

$ScriptDir = (Get-Location).Path
$root = (Get-Item -Path "$ScriptDir\..").FullName

# Parse flags
$DesktopOnly = $cliArgs -match "(?i)(^|\s)(-d|--desktop|-DesktopOnly)($|\s)"
$ExtensionOnly = $cliArgs -match "(?i)(^|\s)(-e|--extension|-ExtensionOnly)($|\s)"
$ServiceOnly = $cliArgs -match "(?i)(^|\s)(-s|--service|-ServiceOnly)($|\s)"
$RunAll = -not ($DesktopOnly -or $ExtensionOnly -or $ServiceOnly)

# Auto-elevate to Administrator if needed (ExtensionOnly does not require admin)
if (-not $ExtensionOnly) {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "Elevating to Administrator privileges..." -ForegroundColor Yellow
        $batPath = "$root\scripts\start.bat"
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"`"$batPath`" $cliArgs`"" -WorkingDirectory $root -Verb RunAs
        exit 0
    }
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "          FocusBlock Launcher            " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check tools
Write-Host "`n[1/4] Checking tools..." -ForegroundColor Yellow
$needsNode = $RunAll -or $DesktopOnly -or $ExtensionOnly
$needsCargo = $RunAll -or $DesktopOnly -or $ServiceOnly

if ($needsNode -and -not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if ($needsCargo -and -not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Rust/Cargo is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Rust from https://rustup.rs/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "Tools found." -ForegroundColor Green

# 2. Check dependencies
Write-Host "`n[2/4] Checking dependencies..." -ForegroundColor Yellow
if ($RunAll -or $DesktopOnly) {
    if (-not (Test-Path "$root\apps\desktop\node_modules")) {
        Write-Host "Installing desktop dependencies..." -ForegroundColor Gray
        Push-Location "$root\apps\desktop"
        $null = npm --silent install --no-fund --no-audit
        Pop-Location
    } else {
        Write-Host "Desktop dependencies present." -ForegroundColor Green
    }
}

if ($RunAll -or $ExtensionOnly) {
    if (-not (Test-Path "$root\apps\extension\node_modules")) {
        Write-Host "Installing extension dependencies..." -ForegroundColor Gray
        Push-Location "$root\apps\extension"
        $null = npm --silent install --no-fund --no-audit
        Pop-Location
    } else {
        Write-Host "Extension dependencies present." -ForegroundColor Green
    }
}

# 3. Build Chrome extension (if All or ExtensionOnly)
if ($RunAll -or $ExtensionOnly) {
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

    if ($ExtensionOnly) {
        Write-Host "`nExtension build complete!" -ForegroundColor Green
        Read-Host "Press Enter to exit"
        exit 0
    }
}

# 4. Start FocusBlock Service (if All, DesktopOnly, or ServiceOnly)
$serviceProcess = $null
if ($RunAll -or $DesktopOnly -or $ServiceOnly) {
    Write-Host "`nStarting FocusBlock Service..." -ForegroundColor Yellow
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

    if ($ServiceOnly) {
        Write-Host "`nFocusBlock Service running. Press Ctrl+C in this terminal to stop." -ForegroundColor Green
        try {
            while ($serviceProcess -and -not $serviceProcess.HasExited) {
                Start-Sleep -Seconds 1
            }
        } finally {
            if ($serviceProcess -and -not $serviceProcess.HasExited) {
                Write-Host "`nStopping FocusBlock Service..." -ForegroundColor Gray
                Stop-Process -Id $serviceProcess.Id -ErrorAction SilentlyContinue
            }
        }
        exit 0
    }
}

# 5. Launch Tauri Desktop App (if All or DesktopOnly)
if ($RunAll -or $DesktopOnly) {
    Write-Host "`nStarting FocusBlock Desktop App..." -ForegroundColor Yellow
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
}

@echo off
title FocusBlock Test Runner
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$cliArgs = '%*'; Invoke-Expression (Get-Content -Path '%~f0' | Select-Object -Skip 6 | Out-String)"
exit /b %ERRORLEVEL%
rem --- PURE POWERSHELL CODE STARTS BELOW ---

$ErrorActionPreference = "Continue"

$ScriptDir = (Get-Location).Path
$RepoRoot = (Get-Item -Path "$ScriptDir\..").FullName

$RustOnly = $cliArgs -match "(?i)(^|\s)(-r|--rust|-RustOnly)($|\s)"
$ExtensionOnly = $cliArgs -match "(?i)(^|\s)(-e|--extension|-ExtensionOnly)($|\s)"
$DesktopOnly = $cliArgs -match "(?i)(^|\s)(-d|--desktop|-DesktopOnly)($|\s)"
$RunAll = -not ($RustOnly -or $ExtensionOnly -or $DesktopOnly)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       FocusBlock - Complete Test Runner          " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Repo root: $RepoRoot`n" -ForegroundColor Gray

$PassedSuites = [System.Collections.Generic.List[string]]::new()
$FailedSuites = [System.Collections.Generic.List[string]]::new()

function Invoke-TestSuite {
    param(
        [string]$Title,
        [string]$Directory,
        [scriptblock]$CommandBlock
    )

    Write-Host "--------------------------------------------------" -ForegroundColor Yellow
    Write-Host " [RUNNING] $Title" -ForegroundColor Yellow
    Write-Host " Folder:   $Directory" -ForegroundColor Gray
    Write-Host "--------------------------------------------------" -ForegroundColor Yellow

    Push-Location $Directory
    try {
        & $CommandBlock
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            Write-Host "`n[FAIL] $Title (Exit code: $exitCode)" -ForegroundColor Red
            $FailedSuites.Add($Title)
        } else {
            Write-Host "`n[PASS] $Title" -ForegroundColor Green
            $PassedSuites.Add($Title)
        }
    } catch {
        Write-Host "`n[ERROR] $Title failed to execute: $_" -ForegroundColor Red
        $FailedSuites.Add($Title)
    } finally {
        Pop-Location
    }
    Write-Host ""
}

# 1. Rust backend suite
if ($RunAll -or $RustOnly) {
    Invoke-TestSuite -Title "Rust Backend (cargo test --workspace)" -Directory $RepoRoot -CommandBlock {
        cargo test --workspace
    }
}

# 2. Chrome Extension suite
if ($RunAll -or $ExtensionOnly) {
    Invoke-TestSuite -Title "Chrome Extension (apps/extension npm test)" -Directory "$RepoRoot\apps\extension" -CommandBlock {
        npm test
    }
}

# 3. Desktop UI suite
if ($RunAll -or $DesktopOnly) {
    Invoke-TestSuite -Title "Desktop UI (apps/desktop npm test)" -Directory "$RepoRoot\apps\desktop" -CommandBlock {
        npm test
    }
}

# Final Summary
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "                 TEST SUMMARY                     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

foreach ($passed in $PassedSuites) {
    Write-Host "  PASSED: $passed" -ForegroundColor Green
}
foreach ($failed in $FailedSuites) {
    Write-Host "  FAILED: $failed" -ForegroundColor Red
}

Write-Host "--------------------------------------------------" -ForegroundColor Cyan

if ($FailedSuites.Count -gt 0) {
    Write-Host "Result: FAILED ($($FailedSuites.Count) suite(s) had errors)" -ForegroundColor Red
    exit 1
} else {
    Write-Host "Result: ALL PASSED ($($PassedSuites.Count) suite(s) successful)" -ForegroundColor Green
    exit 0
}

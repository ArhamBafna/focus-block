# FocusBlock - Complete Test Runner
[CmdletBinding()]
param(
    [switch]$RustOnly,
    [switch]$ExtensionOnly,
    [switch]$DesktopOnly,
    [switch]$E2EOnly,
    [switch]$Headed,
    [switch]$r,
    [switch]$e,
    [switch]$d,
    [switch]$e2e,
    [switch]$v
)

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Get-Item -Path "$ScriptDir\..").FullName

$isRust = $RustOnly -or $r
$isExtension = $ExtensionOnly -or $e
$isDesktop = $DesktopOnly -or $d
$isE2E = $E2EOnly -or $e2e
$isHeaded = $Headed -or $v
$RunAll = -not ($isRust -or $isExtension -or $isDesktop -or $isE2E)

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
if ($RunAll -or $isRust) {
    Invoke-TestSuite -Title "Rust Backend (cargo test --workspace)" -Directory $RepoRoot -CommandBlock {
        cargo test --workspace
    }
}

# 2. Chrome Extension suite
if ($RunAll -or $isExtension) {
    Invoke-TestSuite -Title "Chrome Extension (apps/extension npm test)" -Directory "$RepoRoot\apps\extension" -CommandBlock {
        npm test
    }
}

# 3. Desktop UI suite
if ($RunAll -or $isDesktop) {
    Invoke-TestSuite -Title "Desktop UI (apps/desktop npm test)" -Directory "$RepoRoot\apps\desktop" -CommandBlock {
        npm test
    }
}

# 4. Chrome Extension E2E Playwright suite
if ($RunAll -or $isE2E) {
    Invoke-TestSuite -Title "Chrome Extension E2E (Playwright in tests/e2e)" -Directory "$RepoRoot\tests\e2e" -CommandBlock {
        Write-Host "Compiling latest extension build..." -ForegroundColor Cyan
        npm run build --prefix "$RepoRoot\apps\extension"
        if ($LASTEXITCODE -ne 0) { throw "Extension build failed before E2E tests" }
        $playwrightCmd = if ($isHeaded) { "npx playwright test --headed" } else { "npx playwright test" }
        cmd.exe /c $playwrightCmd
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

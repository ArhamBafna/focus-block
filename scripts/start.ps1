# FocusBlock Launcher
#
# Design rules (learned the hard way):
#   1. Never run focus-service.exe / focus-native-host.exe out of `target\`.
#      Tauri's build script copies `bundle_bins\*` over `target\debug\*` on every
#      build. A running copy holds a lock and the build dies with "os error 32".
#      Instead we copy the freshly built exe to %LOCALAPPDATA%\FocusBlock and run
#      it from there.
#   2. Never let the window close on an error without saying why. Every step is
#      logged to logs\launcher.log and failures keep the window open.
#   3. Never treat external tool output on stderr as a fatal PowerShell error.
[CmdletBinding()]
param(
    # Explicit aliases are required: with [CmdletBinding()] the documented
    # shortcuts would otherwise be ambiguous against the common parameters
    # (-d vs -Debug, -e vs -ErrorAction/-ErrorVariable) and fail before the
    # script starts.
    [Alias("d")][switch]$DesktopOnly,
    [Alias("e")][switch]$ExtensionOnly,
    [Alias("s")][switch]$ServiceOnly
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Get-Item -Path "$ScriptDir\..").FullName

$RunAll = -not ($DesktopOnly -or $ExtensionOnly -or $ServiceOnly)

$LogDir = Join-Path $root "logs"
$LogPath = Join-Path $LogDir "launcher.log"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# One writer for the whole run: simple, fast, and immune to the transient
# file locks that Add-Content hits when an antivirus scanner touches the log.
$script:LogWriter = $null
try {
    $script:LogWriter = New-Object System.IO.StreamWriter($LogPath, $false, (New-Object System.Text.UTF8Encoding($false)))
    $script:LogWriter.AutoFlush = $true
} catch {
    $script:LogWriter = $null
}

function Add-LogLine {
    param([string]$Line)
    if ($script:LogWriter) {
        try { $script:LogWriter.WriteLine($Line) } catch { }
    }
}

function Close-Log {
    if ($script:LogWriter) {
        try { $script:LogWriter.Dispose() } catch { }
        $script:LogWriter = $null
    }
}

Add-LogLine "FocusBlock launcher log - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-LogLine ""

function Write-Log {
    param(
        [string]$Message = "",
        [string]$Color = "Gray"
    )
    Write-Host $Message -ForegroundColor $Color
    Add-LogLine $Message
}

# Runs a command through cmd.exe, shows its output live AND appends it to the log.
# Returns the real exit code of the command.
function Invoke-Logged {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )
    Push-Location $WorkingDirectory
    try {
        # The redirection sits outside the parentheses so *everything* the
        # command writes (stdout AND stderr) goes to one stream: shown live and
        # saved to the log. Out-Host keeps it on screen instead of turning it
        # into this function's return value.
        & cmd.exe /c "($Command) 2>&1" | ForEach-Object {
            Add-LogLine $_
            Write-Host $_
        }
        return $LASTEXITCODE
    } finally {
        Pop-Location
    }
}

function Stop-FocusProcess {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        # Optional wildcard. When set, only processes running from a matching
        # path are stopped - e.g. only the copies inside this repo's target\.
        [string]$OnlyFromPathLike = $null
    )
    $procs = @(Get-Process -Name $Name -ErrorAction SilentlyContinue)

    if ($OnlyFromPathLike) {
        $matching = @()
        foreach ($p in $procs) {
            $exe = $null
            try { $exe = $p.Path } catch { $exe = $null }
            if ($exe -and ($exe -like $OnlyFromPathLike)) { $matching += $p }
        }
        $procs = $matching
    }

    if ($procs.Count -eq 0) { return }
    Write-Log "Stopping running $Name process(es)..." "Gray"
    foreach ($p in $procs) {
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    }
    # Windows keeps an executable locked for a moment after the process exits.
    for ($i = 0; $i -lt 25; $i++) {
        if (-not (Get-Process -Name $Name -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Milliseconds 200
    }
}

function Get-FileHolders {
    param([Parameter(Mandatory = $true)][string]$Path)
    $holders = @()
    try {
        $procs = Get-CimInstance Win32_Process -ErrorAction Stop
        foreach ($p in $procs) {
            $exe = $null
            try { $exe = $p.ExecutablePath } catch { $exe = $null }
            if ($exe -and ($exe -ieq $Path)) {
                $holders += "$($p.Name) (PID $($p.ProcessId))"
            }
        }
    } catch {
        # CIM unavailable - callers fall back to a warning.
    }
    return $holders
}

# Tauri overwrites these files while building the desktop app. If one of them is
# still running, the build fails with "os error 32". Fail early, with a reason.
function Assert-BuildArtifactsUnlocked {
    param([string[]]$Paths)
    foreach ($path in $Paths) {
        if (-not (Test-Path $path)) { continue }
        try {
            $stream = [System.IO.File]::Open($path, 'Open', 'ReadWrite', 'None')
            $stream.Close()
        } catch {
            $holders = @(Get-FileHolders -Path $path)
            if ($holders.Count -gt 0) {
                throw "Build file is locked by a running process: $path`n         Held by: $($holders -join ', ')`n         Stop it and start the launcher again."
            }
            Write-Log "Note: could not verify write access to $path (continuing)." "Yellow"
        }
    }
}

function Show-Failure {
    param([string]$Message)
    Write-Log ""
    Write-Log "=========================================" "Red"
    Write-Log "              LAUNCH FAILED              " "Red"
    Write-Log "=========================================" "Red"
    Write-Log $Message "Red"
    Write-Log ""
    Write-Log "The full log is saved here:" "Yellow"
    Write-Log "  $LogPath" "Cyan"
    Write-Log ""
    Read-Host "Press Enter to close this window"
}

Write-Log "Log file: $LogPath" "DarkGray"

# The app enforces browser/app policy, so it needs Administrator rights.
# ExtensionOnly does not.
if (-not $ExtensionOnly) {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "Elevating to Administrator privileges..." -ForegroundColor Yellow
        $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"")
        if ($DesktopOnly) { $argList += "-DesktopOnly" }
        if ($ExtensionOnly) { $argList += "-ExtensionOnly" }
        if ($ServiceOnly) { $argList += "-ServiceOnly" }
        try {
            Start-Process -FilePath "powershell.exe" -ArgumentList $argList -WorkingDirectory $root -Verb RunAs | Out-Null
        } catch {
            Write-Host ""
            Write-Host "Administrator permission was declined." -ForegroundColor Red
            Write-Host "FocusBlock needs it to block apps and register the browser bridge." -ForegroundColor Yellow
            Read-Host "Press Enter to close this window"
            exit 1
        }
        exit 0
    }
}

Write-Log "=========================================" "Cyan"
Write-Log "          FocusBlock Launcher            " "Cyan"
Write-Log "=========================================" "Cyan"

$serviceProcess = $null
$exitCode = 0

try {
    # ---------------------------------------------------------------- 1 / tools
    Write-Log "`n[1/4] Checking tools..." "Yellow"
    $needsNode = $RunAll -or $DesktopOnly -or $ExtensionOnly
    $needsCargo = $RunAll -or $DesktopOnly -or $ServiceOnly

    if ($needsNode -and -not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        throw "Node.js is not installed or not on PATH. Install it from https://nodejs.org/ and try again."
    }
    if ($needsNode -and -not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
        throw "npm was not found on PATH. Reinstall Node.js from https://nodejs.org/ and try again."
    }
    if ($needsCargo -and -not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
        throw "Rust/Cargo is not installed or not on PATH. Install it from https://rustup.rs/ and try again."
    }
    Write-Log "Tools found." "Green"

    # --------------------------------------------------------- 2 / dependencies
    Write-Log "`n[2/4] Checking dependencies..." "Yellow"

    if ($RunAll -or $DesktopOnly) {
        if (-not (Test-Path "$root\apps\desktop\node_modules")) {
            Write-Log "Installing desktop dependencies..." "Gray"
            $code = Invoke-Logged -Command "npm --silent install --no-fund --no-audit" -WorkingDirectory "$root\apps\desktop"
            if ($code -ne 0) { throw "Desktop dependency install failed (exit $code)." }
        } else {
            Write-Log "Desktop dependencies present." "Green"
        }
    }

    if ($RunAll -or $ExtensionOnly) {
        if (-not (Test-Path "$root\apps\extension\node_modules")) {
            Write-Log "Installing extension dependencies..." "Gray"
            $code = Invoke-Logged -Command "npm --silent install --no-fund --no-audit" -WorkingDirectory "$root\apps\extension"
            if ($code -ne 0) { throw "Extension dependency install failed (exit $code)." }
        } else {
            Write-Log "Extension dependencies present." "Green"
        }
    }

    # -------------------------------------------------------- 3 / extension build
    if ($RunAll -or $ExtensionOnly) {
        Write-Log "`n[3/4] Building Chrome extension..." "Yellow"
        $code = Invoke-Logged -Command "npm run build" -WorkingDirectory "$root\apps\extension"
        if ($code -ne 0) { throw "Chrome extension build failed (exit $code)." }

        $extensionDist = "$root\apps\extension\dist"
        if (-not (Test-Path "$extensionDist\manifest.json")) {
            throw "Chrome extension build finished but $extensionDist\manifest.json is missing."
        }
        Write-Log "Chrome extension built successfully at:" "Green"
        Write-Log "  $extensionDist" "Cyan"
        Write-Log "To load in Chrome: open chrome://extensions -> enable 'Developer mode' -> click 'Load unpacked' -> select dist folder." "Gray"
    }

    # ------------------------------------------- native messaging bridge (needed
    # by both the extension flow and the desktop flow)
    Write-Log "`nConfiguring Chrome Native Messaging Bridge..." "Yellow"
    if (Get-Command "cargo" -ErrorAction SilentlyContinue) {
        # Only a host started from `target\debug` locks the file cargo replaces.
        # Hosts running from %LOCALAPPDATA% are healthy: leave them (and the
        # bridge) alone until the build has actually succeeded.
        $targetBinaries = "$root\target\*"
        Stop-FocusProcess -Name "focus-native-host" -OnlyFromPathLike $targetBinaries

        Assert-BuildArtifactsUnlocked -Paths @("$root\target\debug\focus-native-host.exe")

        $code = Invoke-Logged -Command "cargo build --bin focus-native-host" -WorkingDirectory $root
        if ($code -ne 0) { throw "Building focus-native-host failed (exit $code)." }

        $builtHost = "$root\target\debug\focus-native-host.exe"
        if (-not (Test-Path $builtHost)) {
            throw "focus-native-host.exe was not produced at $builtHost."
        }
        if ((Get-Item $builtHost).Length -le 1024) {
            throw "focus-native-host.exe looks invalid (only $((Get-Item $builtHost).Length) bytes)."
        }

        # Keep a stable copy outside `target\`. Tauri's build overwrites
        # target\debug\*, and an empty placeholder there breaks native messaging.
        $runtimeDir = "$env:LOCALAPPDATA\FocusBlock"
        New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
        $stableHost = "$runtimeDir\focus-native-host.exe"
        # The build succeeded, so now replace the stable copy. Chrome may keep
        # the old one open while it runs, so stop it and retry briefly.
        Stop-FocusProcess -Name "focus-native-host"
        $hostCopied = $false
        for ($attempt = 0; $attempt -lt 40 -and -not $hostCopied; $attempt++) {
            try {
                Copy-Item -Path $builtHost -Destination $stableHost -Force -ErrorAction Stop
                $hostCopied = $true
            } catch {
                Start-Sleep -Milliseconds 300
            }
        }
        if (-not $hostCopied) { throw "Could not copy focus-native-host.exe to $stableHost (file still in use)." }

        $manifestPath = "$runtimeDir\com.focusblock.bridge.json"
        $devId = "gmlbmoeejgjgmeffemfelecnmbiglfld"
        $allowedOrigins = @("chrome-extension://$devId/")

        $relFile = "$runtimeDir\focusblock-web-store-extension-id.txt"
        if (-not (Test-Path $relFile)) {
            $relFile = "$root\focusblock-web-store-extension-id.txt"
        }
        if (Test-Path $relFile) {
            $relId = (Get-Content -Path $relFile -Raw).Trim()
            if ($relId -match '^[a-p]{32}$') {
                $allowedOrigins += "chrome-extension://$relId/"
            }
        }

        $manifestObj = @{
            name            = "com.focusblock.bridge"
            description     = "FocusBlock Chrome policy bridge"
            path            = $stableHost
            type            = "stdio"
            allowed_origins = $allowedOrigins
        }
        $manifestJson = $manifestObj | ConvertTo-Json -Depth 5
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8NoBom)

        $regKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.focusblock.bridge"
        if (-not (Test-Path $regKey)) {
            New-Item -ItemType Directory -Force -Path $regKey | Out-Null
        }
        Set-ItemProperty -Path $regKey -Name "(Default)" -Value $manifestPath -Force | Out-Null

        Write-Log "Chrome Native Messaging host registered at:" "Green"
        Write-Log "  $manifestPath" "Cyan"
    } else {
        Write-Log "Note: Cargo not found; skipping native bridge build." "Gray"
    }

    if ($ExtensionOnly) {
        Write-Log "`nExtension build complete!" "Green"
        Read-Host "Press Enter to exit"
        exit 0
    }

    # --------------------------------------------------------------- 4 / service
    if ($RunAll -or $DesktopOnly -or $ServiceOnly) {
        Write-Log "`n[4/4] Starting FocusBlock Service..." "Yellow"

        # Only a service started from `target\debug` (older launcher versions, or
        # an installed service pointing there) locks the exe cargo replaces.
        # Healthy copies running from %LOCALAPPDATA% keep enforcing while we
        # build, so a failed build never leaves blocking switched off.
        $targetBinaries = "$root\target\*"
        Stop-FocusProcess -Name "focus-service" -OnlyFromPathLike $targetBinaries

        # Enforce the invariant: if anything still holds the repo binary, fail
        # with the holder's name instead of a raw cargo "os error 32".
        Assert-BuildArtifactsUnlocked -Paths @("$root\target\debug\focus-service.exe")

        $code = Invoke-Logged -Command "cargo build --bin focus-service" -WorkingDirectory $root
        if ($code -ne 0) { throw "Building focus-service failed (exit $code)." }

        $builtService = "$root\target\debug\focus-service.exe"
        if (-not (Test-Path $builtService)) {
            throw "focus-service.exe was not produced at $builtService."
        }

        # Build succeeded: replace the running service with the fresh binary.
        Stop-FocusProcess -Name "focus-service"

        # Run from a stable location so the desktop build never fights a lock.
        $runtimeDir = "$env:LOCALAPPDATA\FocusBlock"
        New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
        $stableService = "$runtimeDir\focus-service.exe"
        $copied = $false
        for ($attempt = 0; $attempt -lt 40 -and -not $copied; $attempt++) {
            try {
                Copy-Item -Path $builtService -Destination $stableService -Force -ErrorAction Stop
                $copied = $true
            } catch {
                Start-Sleep -Milliseconds 300
            }
        }
        if (-not $copied) { throw "Could not copy focus-service.exe to $stableService (file still in use)." }

        Write-Log "Launching FocusBlock Service from $stableService" "Gray"
        $serviceProcess = Start-Process -FilePath $stableService -ArgumentList "--console" -WorkingDirectory $root -WindowStyle Minimized -PassThru

        $pipeFound = $false
        for ($i = 0; $i -lt 30; $i++) {
            if ($serviceProcess.HasExited) { break }
            try {
                $pipeFound = [System.IO.Directory]::GetFiles('\\.\pipe\') -contains '\\.\pipe\focusblock'
            } catch {
                $pipeFound = $false
            }
            if ($pipeFound) { break }
            Start-Sleep -Milliseconds 500
        }

        if ($pipeFound) {
            Write-Log "FocusBlock Service ready." "Green"
        } elseif ($serviceProcess.HasExited) {
            throw "FocusBlock Service stopped immediately (exit $($serviceProcess.ExitCode)). Run '.\scripts\start.bat -ServiceOnly' to see its output."
        } else {
            Write-Log "FocusBlock Service is still starting (compiling/warming up)." "Yellow"
        }

        if ($ServiceOnly) {
            Write-Log "`nFocusBlock Service running. Press Ctrl+C in this terminal to stop." "Green"
            while ($serviceProcess -and -not $serviceProcess.HasExited) {
                Start-Sleep -Seconds 1
            }
            exit 0
        }
    }

    # ----------------------------------------------------------- 4b / desktop app
    if ($RunAll -or $DesktopOnly) {
        Write-Log "`nStarting FocusBlock Desktop App..." "Yellow"

        Stop-FocusProcess -Name "desktop"
        # Tauri copies over target\debug\focus-native-host.exe; only hosts
        # running from target\ hold that file.
        Stop-FocusProcess -Name "focus-native-host" -OnlyFromPathLike "$root\target\*"

        # Last line of defence: these are exactly the files Tauri overwrites.
        Assert-BuildArtifactsUnlocked -Paths @(
            "$root\target\debug\focus-service.exe",
            "$root\target\debug\focus-native-host.exe",
            "$root\target\debug\desktop.exe"
        )

        Write-Log "App window will open shortly. Press Ctrl+C in this terminal to stop." "Gray"
        Write-Log "Live output is also saved to: $LogPath" "DarkGray"
        Write-Log ""

        $appCode = Invoke-Logged -Command "npm run tauri dev" -WorkingDirectory "$root\apps\desktop"
        if ($appCode -ne 0) {
            throw "The desktop app exited with code $appCode. The full build output is in the log file above."
        }
        Write-Log "`nFocusBlock Desktop App closed." "Green"
    }
} catch {
    Show-Failure -Message $_.Exception.Message
    $exitCode = 1
} finally {
    if ($serviceProcess -and -not $serviceProcess.HasExited) {
        Write-Log "`nStopping FocusBlock Service..." "Gray"
        Stop-Process -Id $serviceProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Close-Log
}

exit $exitCode


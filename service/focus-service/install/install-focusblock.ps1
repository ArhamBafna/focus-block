#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ServiceExecutablePath,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$NativeHostExecutablePath,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId,

    [ValidateSet('CurrentUser', 'LocalMachine')]
    [string]$NativeHostScope = 'LocalMachine'
)

$ErrorActionPreference = 'Stop'
$serviceName = 'FocusBlockService'
$hostName = 'com.focusblock.bridge'
$servicePath = (Resolve-Path -LiteralPath $ServiceExecutablePath).Path
$nativeHostPath = (Resolve-Path -LiteralPath $NativeHostExecutablePath).Path
$templatePath = Join-Path $PSScriptRoot 'focus-native-host-manifest.template.json'
$manifestDirectory = Join-Path $env:ProgramData 'FocusBlock'
$manifestPath = Join-Path $manifestDirectory "$hostName.json"

New-Item -ItemType Directory -Force -Path $manifestDirectory | Out-Null
$manifest = Get-Content -LiteralPath $templatePath -Raw
$manifest = $manifest.Replace('__FOCUSBLOCK_NATIVE_HOST_PATH__', $nativeHostPath.Replace('\', '\\'))
$manifest = $manifest.Replace('__FOCUSBLOCK_EXTENSION_ID__', $ExtensionId)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestPath, $manifest, $utf8NoBom)

if (-not (Get-Service -Name $serviceName -ErrorAction SilentlyContinue)) {
    New-Service -Name $serviceName -BinaryPathName ('"{0}"' -f $servicePath) -DisplayName 'FocusBlock Service' -StartupType Automatic
} else {
    & sc.exe config $serviceName binPath= ('"{0}"' -f $servicePath) start= auto | Out-Null
}

# Restart only after actual failures. Normal Stop/Shutdown preserves the active
# policy snapshot for service rehydration after Windows restarts.
& sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/5000/restart/15000 | Out-Null
& sc.exe failureflag $serviceName 0 | Out-Null

$registryRoot = if ($NativeHostScope -eq 'CurrentUser') {
    'HKCU:\Software\Google\Chrome\NativeMessagingHosts'
} else {
    'HKLM:\Software\Google\Chrome\NativeMessagingHosts'
}
$registryKey = Join-Path $registryRoot $hostName
New-Item -ItemType Directory -Force -Path $registryKey | Out-Null
New-ItemProperty -Path $registryKey -Name '(Default)' -Value $manifestPath -PropertyType String -Force | Out-Null

$service = Get-Service -Name $serviceName
if ($service.Status -ne 'Running') {
    Start-Service -Name $serviceName
}

Write-Output "Installed $serviceName and registered $hostName for chrome-extension://$ExtensionId/."

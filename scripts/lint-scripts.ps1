$scripts = Get-ChildItem -Path "$PSScriptRoot\..\scripts" -Filter *.ps1
$hasError = $false

foreach ($script in $scripts) {
    $parseErrors = $null
    $tokens = $null
    $null = [System.Management.Automation.Language.Parser]::ParseFile($script.FullName, [ref]$tokens, [ref]$parseErrors)
    
    if ($parseErrors -and $parseErrors.Count -gt 0) {
        Write-Host "ERROR in $($script.Name):" -ForegroundColor Red
        foreach ($err in $parseErrors) {
            Write-Host "  Line $($err.Extent.StartLineNumber): $($err.Message)" -ForegroundColor Red
        }
        $hasError = $true
    } else {
        Write-Host "OK: $($script.Name)" -ForegroundColor Green
    }
}

if ($hasError) {
    exit 1
}
Write-Host "`nAll PowerShell scripts parsed successfully." -ForegroundColor Green
exit 0

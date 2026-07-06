function sdk {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]] $SdkArgs)

    $sdkctlCommand = if (Get-Command sdkctl-core.exe -ErrorAction SilentlyContinue) {
        (Get-Command sdkctl-core.exe).Source
    } else {
        (Get-Command sdkctl.exe -ErrorAction Stop).Source
    }
    if ($SdkArgs.Count -gt 0 -and $SdkArgs[0] -eq 'use') {
        & $sdkctlCommand @SdkArgs --hook
    } else {
        & $sdkctlCommand @SdkArgs
    }
    $sdkctlExitCode = $LASTEXITCODE

    if ($sdkctlExitCode -eq 0 -and $SdkArgs.Count -gt 0 -and $SdkArgs[0] -in @('use', 'remove', 'rm')) {
        $sdkctlEnvironment = & $sdkctlCommand env --shell powershell
        if ($LASTEXITCODE -eq 0) {
            Invoke-Expression ($sdkctlEnvironment -join [Environment]::NewLine)
        }
    }
    $global:LASTEXITCODE = $sdkctlExitCode
}

Export-ModuleMember -Function sdk

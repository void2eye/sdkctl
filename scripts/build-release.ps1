$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Push-Location $project
try {
    & npm.cmd install --package-lock-only
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
    & npm.cmd run build:exe
    if ($LASTEXITCODE -ne 0) { throw 'Standalone build failed' }

    & (Join-Path $project 'scripts\sign-file.ps1') -FilePath (Join-Path $project 'dist\sdkctl.exe')
    & node (Join-Path $project 'scripts\build-installer.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Installer build failed' }

    $setup = Join-Path $project 'dist\installer\sdkctl-setup-0.1.3-x64.exe'
    & (Join-Path $project 'scripts\sign-file.ps1') -FilePath $setup

    $setupHash = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash
    $hashFile = "$setup.sha256.txt"
    [IO.File]::WriteAllText($hashFile, "$setupHash  $([IO.Path]::GetFileName($setup))`r`n", (New-Object Text.UTF8Encoding($false)))
    Write-Host "Release: $setup"
    Write-Host "SHA256: $setupHash"
    Write-Host "Hash file: $hashFile"
} finally {
    Pop-Location
}

$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot
try {
    $npm = Get-Command npm.cmd -ErrorAction Stop
    & $npm.Source link
    if ($LASTEXITCODE -ne 0) { throw "npm link 执行失败，退出码: $LASTEXITCODE" }
    & sdkctl init
    Write-Host ''
    Write-Host '安装完成。建议执行：'
    Write-Host '  sdkctl scan D:\SDK'
    Write-Host '  Invoke-Expression ((& sdkctl env --shell powershell) -join [Environment]::NewLine)'
} finally {
    Pop-Location
}

param(
    [Parameter(Mandatory = $true)][string] $FilePath,
    [string] $Thumbprint,
    [string] $TimestampServer = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $Thumbprint) {
    $configPath = Join-Path $project '.secrets\signing-config.json'
    if (-not (Test-Path -LiteralPath $configPath)) {
        throw "Missing signing config: $configPath"
    }
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $Thumbprint = $config.thumbprint
}

$certificatePath = "Cert:\CurrentUser\My\$Thumbprint"
if (-not (Test-Path -LiteralPath $certificatePath)) {
    throw "Signing certificate is not installed: $Thumbprint"
}
$certificate = Get-Item -LiteralPath $certificatePath
if (-not $certificate.HasPrivateKey) { throw 'Signing certificate has no private key' }

$resolvedFile = (Resolve-Path -LiteralPath $FilePath).Path
$signToolCandidates = @(
    $env:SIGNTOOL_PATH
    (Get-ChildItem (Join-Path $project '.tools\WindowsSDKBuildTools\bin') -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
        Where-Object FullName -Like '*\x64\signtool.exe' |
        Select-Object -Last 1 -ExpandProperty FullName)
    (Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
        Where-Object FullName -Like '*\x64\signtool.exe' |
        Select-Object -Last 1 -ExpandProperty FullName)
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$signTool = $signToolCandidates | Select-Object -First 1
if (-not $signTool) { throw 'signtool.exe was not found. Install Windows SDK Signing Tools or set SIGNTOOL_PATH.' }

# Node executables carry a Microsoft signature that becomes invalid after SEA injection.
# Remove that stale signature before applying the publisher signature.
function Invoke-SignTool([string[]] $Arguments, [switch] $IgnoreFailure) {
    $process = Start-Process -FilePath $signTool -ArgumentList $Arguments -NoNewWindow -Wait -PassThru
    if (-not $IgnoreFailure -and $process.ExitCode -ne 0) {
        throw "SignTool failed with exit code $($process.ExitCode): $($Arguments -join ' ')"
    }
    return $process.ExitCode
}

$existingSignature = Get-AuthenticodeSignature -LiteralPath $resolvedFile
if ($existingSignature.SignerCertificate) {
    Invoke-SignTool -Arguments @('remove', '/s', $resolvedFile) -IgnoreFailure | Out-Null
}

Invoke-SignTool -Arguments @('sign', '/sha1', $Thumbprint, '/fd', 'SHA256', '/d', 'sdkctl', '/du', 'https://github.com/void2eye/sdkctl', $resolvedFile) | Out-Null

Invoke-SignTool -Arguments @('timestamp', '/tr', $TimestampServer, '/td', 'SHA256', $resolvedFile) | Out-Null
Invoke-SignTool -Arguments @('verify', '/pa', '/q', $resolvedFile) | Out-Null

$signature = Get-AuthenticodeSignature -LiteralPath $resolvedFile

if ($signature.Status -ne 'Valid') {
    throw "Signing failed for $resolvedFile : $($signature.Status) $($signature.StatusMessage)"
}
if ($signature.SignerCertificate.Thumbprint -ne $certificate.Thumbprint) {
    throw "Unexpected signer on $resolvedFile"
}

Write-Host "Signed: $resolvedFile"
Write-Host "Signer: $($certificate.Subject)"
Write-Host "Thumbprint: $($certificate.Thumbprint)"

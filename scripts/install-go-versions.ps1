param(
    [int[]] $MinorVersions = (18..26),
    [string] $Destination = 'D:\SDK\Go',
    [switch] $KeepArchives
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

New-Item -ItemType Directory -Path $Destination -Force | Out-Null
$downloadDirectory = Join-Path $Destination '_downloads'
New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
$releases = Invoke-RestMethod -Uri 'https://go.dev/dl/?mode=json&include=all'
$installed = @()

foreach ($minor in $MinorVersions) {
    $release = $releases |
        Where-Object { $_.stable -and $_.version -match "^go1\.$minor\.\d+$" } |
        Sort-Object { [version]($_.version.Substring(2)) } -Descending |
        Select-Object -First 1
    if (-not $release) { throw "No stable Go 1.$minor release found" }

    $file = $release.files |
        Where-Object { $_.os -eq 'windows' -and $_.arch -eq 'amd64' -and $_.kind -eq 'archive' } |
        Select-Object -First 1
    if (-not $file) { throw "No Windows amd64 archive found for $($release.version)" }

    $target = Join-Path $Destination $release.version
    $goExecutable = Join-Path $target 'bin\go.exe'
    if (Test-Path -LiteralPath $goExecutable) {
        Write-Host "[skip] $($release.version) is already installed"
        $installed += $target
        continue
    }
    if (Test-Path -LiteralPath $target) {
        throw "Target exists but is not a valid Go SDK: $target"
    }

    $archive = Join-Path $downloadDirectory $file.filename
    if (Test-Path -LiteralPath $archive) {
        $cachedHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($cachedHash -ne $file.sha256.ToLowerInvariant()) { Remove-Item -LiteralPath $archive -Force }
    }
    if (-not (Test-Path -LiteralPath $archive)) {
        Write-Host "[download] $($release.version) ($([math]::Round($file.size / 1MB, 1)) MB)"
        & curl.exe --http1.1 --fail --location --connect-timeout 20 --speed-time 30 --speed-limit 1024 --retry 10 --retry-all-errors --retry-delay 3 --continue-at - --output $archive "https://mirrors.aliyun.com/golang/$($file.filename)"
        if ($LASTEXITCODE -ne 0) { throw "Download failed: $($file.filename)" }
    }

    $actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $file.sha256.ToLowerInvariant()) {
        Remove-Item -LiteralPath $archive -Force
        throw "Checksum mismatch: $($file.filename)"
    }

    $staging = Join-Path $Destination ".extract-$($release.version)-$PID"
    if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    New-Item -ItemType Directory -Path $staging | Out-Null
    try {
        Write-Host "[extract] $($release.version)"
        [IO.Compression.ZipFile]::ExtractToDirectory($archive, $staging)
        Move-Item -LiteralPath (Join-Path $staging 'go') -Destination $target
    } finally {
        if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    }
    if (-not $KeepArchives) { Remove-Item -LiteralPath $archive -Force }
    $installed += $target
}

if (-not $KeepArchives -and (Test-Path -LiteralPath $downloadDirectory) -and
    -not (Get-ChildItem -LiteralPath $downloadDirectory -Force | Select-Object -First 1)) {
    Remove-Item -LiteralPath $downloadDirectory
}

Write-Host "Done: prepared $($installed.Count) Go SDKs"
$installed

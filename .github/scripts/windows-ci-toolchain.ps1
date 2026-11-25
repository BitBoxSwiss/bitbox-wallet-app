# SPDX-License-Identifier: Apache-2.0
# Hosted runners receive tool updates independently of this release's toolchain.
$ErrorActionPreference = 'Stop'
if ($env:RUNNER_ENVIRONMENT -ne 'github-hosted') { throw 'Provisioning requires a GitHub-hosted runner.' }
. ./frontends/qt/windows-toolchain.ps1
$pins = Get-Content -Raw frontends/qt/windows-toolchain.json | ConvertFrom-Json
$candidates = Get-ToolCandidates

function Has-Pin([string] $Name) {
    foreach ($root in $candidates[$Name]) {
        if (!(Test-ToolFiles $pins.$Name $root)) { return $true }
    }
    return $false
}

function Get-PinnedDownload([string] $Url, [string] $Hash) {
    $path = Join-Path $env:RUNNER_TEMP ($Url.Split('/')[-1])
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $path
    if ((Get-FileHash -LiteralPath $path).Hash -ne $Hash) { throw "Incorrect SHA-256 for $Url." }
    return $path
}

$mingw = $pins.mingw
choco.exe upgrade mingw "--version=$($mingw.version)" --allow-downgrade --yes --no-progress `
    "--checksum64=$($mingw.archiveSha256)" --checksumtype64=sha256
if ($LASTEXITCODE -ne 0) { throw "Chocolatey could not install mingw $($mingw.version) (exit $LASTEXITCODE)." }

if (!(Has-Pin msvc) -or !(Has-Pin redist) -or !(Has-Pin sdk)) {
    $installer = Get-PinnedDownload $pins.msvc.url $pins.msvc.sha256
    $process = Start-Process $installer -Wait -PassThru -ArgumentList @(
        '--quiet', '--wait', '--norestart', '--installPath', "`"$env:RUNNER_TEMP\release-vs`"",
        '--add', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
        '--add', $pins.sdk.component)
    if ($process.ExitCode -notin @(0, 3010)) { throw "Visual Studio Build Tools installation failed ($($process.ExitCode))." }
}

#Requires -Version 5.1
# SPDX-License-Identifier: Apache-2.0
param([switch] $CheckOnly, [switch] $Installer)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-toolchain.ps1"
. "$PSScriptRoot\windows-build-helpers.ps1"

# Use a fixed physical checkout: shells can resolve drive aliases back to host paths.
# Go's -trimpath does not cover gnark-crypto's shared assembly includes.
# The fixed-checkout requirement can be lifted once either fix is adopted in our
# vendored gnark-crypto dependency or pinned Go toolchain:
# https://github.com/Consensys-Incorporated/gnark-crypto/pull/981
# https://github.com/golang/go/issues/83378
# Temporary files and outputs live under the ignored frontends/qt/build directory.
# Use the verified tools directly at their installation paths.
# Use QT_ROOT_DIR or MINGW_BIN to identify installations outside the discovered locations.

# Windows 10 and 11 also use the Windows_NT environment value.
if ($env:OS -ne 'Windows_NT' -or ![Environment]::Is64BitProcess) {
    throw 'Run this script in 64-bit PowerShell on Windows.'
}
$root = 'C:\bitbox-wallet-app'
Test-CheckoutLocation (Get-Item "$PSScriptRoot\..\..").FullName $root
$pins = Get-Content -Raw -LiteralPath "$PSScriptRoot\windows-toolchain.json" | ConvertFrom-Json
$tools = Get-VerifiedToolchain $pins (Get-ToolCandidates)
# Resolve the optional installer tool before replacing PATH with the pinned build toolchain.
$nsis = $null
if ($Installer) {
    $nsis = (Get-Command makensis.exe -CommandType Application -ErrorAction SilentlyContinue).Source
    if (!$nsis) { throw 'NSIS is required for installer packaging. Install it with: choco install nsis' }
}
# Make runs this in a fresh PowerShell process; environment changes end with it.
# Start with OS facilities only. Compiler flags, Go/npm configuration, Qt overrides,
# Visual Studio developer shells, shell startup files and the caller's PATH must not leak in.
$keep = @('SystemRoot','SystemDrive','windir','ProgramFiles','ProgramFiles(x86)','ProgramW6432',
    'ProgramData','LOCALAPPDATA','APPDATA','USERPROFILE','USERNAME','COMPUTERNAME','OS','PROCESSOR_ARCHITECTURE',
    'PSModulePath','TEMP','TMP','HTTP_PROXY','HTTPS_PROXY','NO_PROXY','SSL_CERT_FILE','NODE_EXTRA_CA_CERTS')
foreach ($key in [Environment]::GetEnvironmentVariables().Keys) {
    if ($key -notin $keep) { [Environment]::SetEnvironmentVariable($key, $null) }
}
$env:ComSpec = "$env:SystemRoot\System32\cmd.exe"
$env:PATHEXT = '.COM;.EXE;.BAT;.CMD'
$env:PATH = "$($tools.qt)\bin;$($tools.redist);$env:SystemRoot\System32;$env:SystemRoot"
Test-QtPaths $tools.qt
if ($CheckOnly) { return }
Test-BuildCheckout "$($tools.git)\cmd\git.exe" $root

$buildRoot = "$root\frontends\qt\build"
if ([IO.Directory]::Exists($buildRoot)) {
    # Directory.Delete removes links without following their targets.
    [IO.Directory]::Delete($buildRoot, $true)
}
[void][IO.Directory]::CreateDirectory($buildRoot)
foreach ($dir in @('temp','config')) { [void][IO.Directory]::CreateDirectory("$buildRoot\$dir") }
$env:TEMP = $env:TMP = "$buildRoot\temp"
# Keep Git's system and user config so status uses the checkout's line-ending rules.
$env:GIT_TERMINAL_PROMPT = '0'
$env:GOROOT = $tools.go
$env:GOTOOLCHAIN = 'local'
$env:GOENV = 'off'
# Always use this checkout's vendored modules, even inside a larger Go workspace.
$env:GOWORK = 'off'
$env:GOCACHE = "$buildRoot\temp\go-cache"
$env:GOPATH = "$buildRoot\temp\gopath"
$env:CC = 'gcc'
$env:CXX = 'g++'
$env:NPM_CONFIG_USERCONFIG = "$buildRoot\config\.npmrc"
$env:NPM_CONFIG_GLOBALCONFIG = "$buildRoot\config\global.npmrc"
$env:NPM_CONFIG_PREFIX = "$buildRoot\npm-prefix"
$env:NPM_CONFIG_CACHE = "$buildRoot\temp\npm-cache"
$env:LC_ALL = $env:LANG = 'C'
$env:TZ = 'UTC'
$env:QT_HASH_SEED = '0'
$env:BITBOX_WINDOWS_MAKE = "$($tools.mingw.Replace('\', '/'))/bin/mingw32-make.exe"
$env:BITBOX_QT_BIN = "$($tools.qt.Replace('\', '/'))/bin"
$env:BITBOX_GIT_BIN = "$($tools.git.Replace('\', '/'))/usr/bin"
$payload = "$buildRoot\windows"
$env:BITBOX_VS_ROOT = $tools.vs
$env:BITBOX_SDK_ROOT = $tools.kits
$env:BITBOX_VC_VERSION = $pins.msvc.directory
$env:BITBOX_SDK_VERSION = $pins.sdk.directory
$vc = $tools.msvc
$sdkBin = "$($tools.sdk)\x64"
$sdkInclude = "$($tools.kits)\Include\$($pins.sdk.directory)"
$sdkLib = "$($tools.kits)\Lib\$($pins.sdk.directory)"
$env:BITBOX_VC_BIN = "$vc\bin\Hostx64\x64"
$env:BITBOX_CRT = $tools.redist
$env:BITBOX_INCLUDE = "$vc\include;$sdkInclude\ucrt;$sdkInclude\shared;$sdkInclude\um;$sdkInclude\winrt;$sdkInclude\cppwinrt"
$env:BITBOX_LIB = "$vc\lib\x64;$sdkLib\ucrt\x64;$sdkLib\um\x64"
$systemPath = "$env:SystemRoot\System32;$env:SystemRoot;$env:SystemRoot\System32\Wbem;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
$env:BITBOX_COMPILE_PATH = "$env:BITBOX_VC_BIN;$sdkBin;$($tools.qt)\bin;$env:BITBOX_CRT;$($tools.node);$($tools.go)\bin;$($tools.mingw)\bin;$($tools.git)\cmd;$($tools.git)\usr\bin;$systemPath"
$env:PATH = $env:BITBOX_COMPILE_PATH
# Optional Qt add-ons can change the installed plug-ins even at the pinned version
# (e.g. qtimageformats adds qwebp.dll). windeployqt may pick them up automatically.
# Keep only the plug-ins listed in qt.runtime so local extras do not change the payload.
# --include-plugins is additive, so exclude the other installed plug-ins instead.
# Entries with "/" identify plug-ins; convert e.g. imageformats/qjpeg.dll to qjpeg
# for --exclude-plugins, which takes a comma-separated list without ".dll".
$allowedPluginNames = $pins.qt.runtime | Where-Object { $_.Contains('/') } | ForEach-Object { [IO.Path]::GetFileNameWithoutExtension($_) }
$excludedPluginNames = Get-ChildItem -Path "$($tools.qt)\plugins\*\*.dll" -File |
    Where-Object { $_.BaseName -notin $allowedPluginNames } | ForEach-Object BaseName | Sort-Object -Unique
$env:BITBOX_QT_EXCLUDE_PLUGINS = $excludedPluginNames -join ','

# Keep Git's signature display settings out of the machine-readable timestamp.
$env:SOURCE_DATE_EPOCH = Invoke-Native "$($tools.git)\cmd\git.exe" @('-C', $root, 'show', '--no-show-signature', '-s', '--format=%ct', 'HEAD')
if ($env:SOURCE_DATE_EPOCH -notmatch '\A[0-9]+\z') {
    throw 'Git did not return a valid commit timestamp.'
}
Write-Host "Building the working tree at $root"
Push-Location -LiteralPath $root
try {
    Invoke-Native "$($tools.git)\usr\bin\bash.exe" @('--noprofile', '--norc', 'frontends/qt/make_windows.sh')
} finally { Pop-Location }

Test-DeployedBinaries $payload
$version = [IO.File]::ReadAllText("$root\APP_VERSION").Trim()
$destination = Join-Path $buildRoot "BitBox-$version-win64-build.tar.gz"
Invoke-Native "$($tools.git)\usr\bin\bash.exe" @('--noprofile', '--norc', 'C:/bitbox-wallet-app/frontends/qt/archive_windows.sh',
    $destination.Replace('\', '/'))
Write-Host "Created $destination (SHA-256 $((Get-FileHash -LiteralPath $destination).Hash))"

# CI packages the same application files as the archive.
if ($Installer) {
    Push-Location -LiteralPath "$root\frontends\qt"
    try {
        Invoke-Native $nsis @("-DVERSION=${version}.0", "-DBINDIR=$payload",
            '-DICONFILE=resources/win/icon.ico', 'setup.nsi')
    } finally { Pop-Location }
}

# SPDX-License-Identifier: Apache-2.0
# Shared build checks. Loading this file only defines functions.

function Invoke-Native([string] $Program, [string[]] $Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program $($Arguments -join ' ') failed ($LASTEXITCODE)." }
}

function Test-CheckoutLocation([string] $Checkout, [string] $Required) {
    $instruction = "Windows archive builds require a physical checkout at $Required.`n" +
        'Clone or move the checkout there, then rerun this command. Junctions and drive aliases are not supported.'
    if ($Checkout -ne $Required -or
        ((Get-Item -LiteralPath $Checkout -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw $instruction
    }

    # Resolve an open tracked file through Windows, including any junctions or drive aliases.
    # Get-Item alone can return the alias rather than its physical location.
    if (!('WindowsCheckoutPath' -as [type])) {
        Add-Type @'
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;
public static class WindowsCheckoutPath {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern uint GetFinalPathNameByHandle(
        SafeFileHandle file, StringBuilder path, uint capacity, uint flags);
}
'@
    }
    $file = [IO.File]::OpenRead("$Checkout\APP_VERSION")
    try {
        $path = [Text.StringBuilder]::new(32768)
        $length = [WindowsCheckoutPath]::GetFinalPathNameByHandle($file.SafeFileHandle, $path, $path.Capacity, 0)
        if (!$length -or $length -ge $path.Capacity) {
            throw "Cannot resolve the physical checkout path (Windows error $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))."
        }
        if ($path.ToString() -cne "\\?\$Required\APP_VERSION") {
            throw "$instruction`nResolved APP_VERSION path: $path"
        }
    } finally { $file.Dispose() }
}

function Test-BuildCheckout([string] $Git, [string] $Checkout) {
    # Git can report a clean checkout even when it has converted LF to CRLF on disk.
    # Our text=auto eol=lf policy preserves CRLF already present in the index.
    $converted = @(Invoke-Native $Git @('-C', $Checkout, 'ls-files', '--eol') | Where-Object {
        if ($_ -match '^i/(lf|crlf|mixed|none)\s+w/(lf|crlf|mixed)\s+') {
            $index, $working = $Matches[1], $Matches[2]
            $expected = if ($index -eq 'none') { 'lf' } else { $index }
            $working -ne $expected
        }
    })
    if ($converted.Count) {
        $examples = ($converted | Select-Object -First 5) -join [Environment]::NewLine
        throw ("Unexpected line endings in $($converted.Count) tracked paths under $Checkout.`n" +
            "Refresh your clean checkout or correct the line endings in edited files, then rebuild.`n" +
            "Run 'git ls-files --eol' there to see the index (i/) and working tree (w/).`n$examples")
    }
    if (!(Test-Path -LiteralPath "$Checkout\.gitmodules")) { return }
    $links = Invoke-Native $Git @('-C', $Checkout, '-c', 'core.quotepath=false', 'ls-files', '--stage') |
        Where-Object { $_ -like '160000 *' }
    foreach ($link in $links) {
        $entry, $path = $link -split "`t", 2
        if (!$entry.EndsWith(' 0')) { throw "Resolve the submodule conflict at $Checkout\$path." }
        $module = Join-Path $Checkout $path
        if (!(Test-Path -LiteralPath "$module\.git")) {
            throw "Missing submodule $path. Run 'git submodule update --init --recursive'."
        }
    }
}

function Test-QtPaths([string] $Qt) {
    $query = @{}
    foreach ($line in (Invoke-Native "$Qt\bin\qtpaths.exe" @('--query'))) {
        $key, $value = $line -split ':', 2
        $query[$key] = $value
    }
    if ($query.QT_VERSION -ne $pins.qt.version -or $query.QMAKE_XSPEC -ne 'win32-msvc') {
        throw "Expected the Qt $($pins.qt.version) win32-msvc kit at $Qt."
    }
    $dirs = @{
        QT_INSTALL_PREFIX = '.'; QT_INSTALL_BINS = 'bin'; QT_HOST_BINS = 'bin'; QT_INSTALL_LIBEXECS = 'bin'
        QT_INSTALL_HEADERS = 'include'; QT_INSTALL_LIBS = 'lib'; QT_INSTALL_PLUGINS = 'plugins'
        QT_INSTALL_DATA = '.'; QT_INSTALL_QML = 'qml'; QT_INSTALL_TRANSLATIONS = 'translations'
    }
    foreach ($key in $dirs.Keys) {
        $expected = Get-PhysicalDirectory (Join-Path $Qt $dirs[$key])
        if (!$query[$key] -or (Get-PhysicalDirectory $query[$key]) -ne $expected) {
            throw "The kit at $Qt resolves $key to '$($query[$key])'. Repair its qt.conf to use $expected."
        }
    }
}

function Test-DeployedBinaries([string] $Payload) {
    $expected = @('BitBox.exe', 'libserver.dll', 'breez_sdk_spark_bindings.dll') +
        $pins.qt.runtime + $pins.redist.files.PSObject.Properties.Name
    $actual = Get-ChildItem -LiteralPath $Payload -Recurse -File |
        Where-Object { $_.Extension -in @('.dll', '.exe') } |
        ForEach-Object { $_.FullName.Substring($Payload.Length + 1).Replace('\', '/') }
    $differences = @(Compare-Object $expected $actual -CaseSensitive)
    if ($differences) {
        foreach ($item in $differences) {
            $label = if ($item.SideIndicator -eq '=>') { 'Unexpected' } else { 'Missing' }
            Write-Host "$label deployed binary $($item.InputObject)"
        }
        throw "Qt deployment differs from the release. Check the components of $($tools.qt) against the toolchain manifest."
    }
}

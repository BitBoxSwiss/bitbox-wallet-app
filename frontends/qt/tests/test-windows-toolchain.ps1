# SPDX-License-Identifier: Apache-2.0
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../windows-toolchain.ps1"
$work = [IO.Directory]::CreateDirectory((Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid()))).FullName
$oldPath = $env:PATH
try {
    $wrong = [IO.Directory]::CreateDirectory((Join-Path $work 'old')).FullName
    $right = [IO.Directory]::CreateDirectory((Join-Path $work 'pinned')).FullName
    foreach ($root in @($wrong, $right)) {
        $bin = [IO.Directory]::CreateDirectory((Join-Path $root 'bin')).FullName
        [IO.File]::WriteAllText((Join-Path $bin 'tool.exe'), $root)
    }
    $pin = [pscustomobject]@{version = '1'; install = 'fixture 1'; files = [pscustomobject]@{
        'bin/tool.exe' = (Get-FileHash -LiteralPath (Join-Path $right 'bin/tool.exe')).Hash
    }}
    # Registry, PATH and a directory junction can all identify one installation behind an older tool.
    $alias = Join-Path $work 'alias'
    $linkType = if ($env:OS -eq 'Windows_NT') { 'Junction' } else { 'SymbolicLink' }
    [void](New-Item -ItemType $linkType -Path $alias -Target $right)
    $env:PATH = @((Join-Path $wrong bin), (Join-Path $alias bin), (Join-Path $right bin)) -join ';'
    $roots = @(Find-ToolRoots @($right) tool.exe bin/tool.exe)
    if ($roots.Count -ne 2 -or $wrong -notin $roots -or $right -notin $roots) { throw 'Wrong discovered roots.' }
    # Other versions may remain installed; both local builds and CI select only a byte-matching tool.
    if ((Select-ToolRoot fixture $pin $roots) -ne $right) { throw 'Wrong tool selected behind an older version.' }
    if ((Select-ToolRoot fixture $pin @($right)) -ne $right) { throw 'Pinned local tool was rejected.' }
    # Missing or modified tool files must fail even when the expected version directory still exists.
    [IO.File]::Delete((Join-Path $right 'bin/tool.exe'))
    if (Select-ToolRoot fixture $pin @($right)) { throw 'An incomplete tool was accepted.' }
    if (Select-ToolRoot fixture $pin @($wrong)) { throw 'An unpinned tool was accepted.' }

    # Discovery includes a competing GCC on PATH so its files can be checked against the pin.
    [IO.File]::WriteAllText((Join-Path $wrong 'bin/gcc.exe'), 'other GCC')
    if ($wrong -notin (Get-ToolCandidates).mingw) { throw 'Local GCC on PATH was not found.' }

    # A mismatched local MinGW installation reports the interactive command for the pinned package.
    $manifest = Get-Content -Raw "$PSScriptRoot/../windows-toolchain.json" | ConvertFrom-Json
    $help = (Select-ToolRoot mingw $manifest.mingw @($wrong) 6>&1) -join "`n"
    if (!$help.Contains("choco upgrade mingw --version=$($manifest.mingw.version) --allow-downgrade")) {
        throw 'Missing Chocolatey install command.'
    }

    # Resolve a tool under a hidden parent such as ProgramData, including a hidden directory on PATH.
    $hiddenParent = [IO.Directory]::CreateDirectory((Join-Path $work '.ProgramData'))
    $root = Join-Path $hiddenParent.FullName 'tool'
    $bin = [IO.Directory]::CreateDirectory((Join-Path $root '.bin'))
    if ($env:OS -eq 'Windows_NT') {
        foreach ($dir in @($hiddenParent, $bin)) { $dir.Attributes = $dir.Attributes -bor [IO.FileAttributes]::Hidden }
    }
    [IO.File]::WriteAllText((Join-Path $bin.FullName 'tool.exe'), 'fixture')
    $env:PATH = $bin.FullName
    $roots = @(Find-ToolRoots @($root) tool.exe .bin/tool.exe)
    if ($roots.Count -ne 1 -or $roots[0] -ne $root) { throw 'Tool under a hidden directory was not discovered.' }

    # Different Git for Windows releases can supply the shell. A missing Bash still prevents a build.
    $git = $manifest.git
    foreach ($root in @($wrong, $right)) {
        foreach ($command in $git.commands) {
            $path = Join-Path $root $command
            [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path))
            [IO.File]::WriteAllText($path, $root)
        }
        if ((Select-ToolRoot git $git @($root)) -ne $root) { throw 'Complete Git Bash installation was rejected.' }
    }
    [IO.File]::Delete((Join-Path $right 'usr/bin/bash.exe'))
    if (Select-ToolRoot git $git @($right)) { throw 'Git without Bash was accepted.' }

    # Kit roots used by vcvarsall and the compiler are derived from the actual versioned tool directories.
    $vs = Join-Path $work 'VS Build Tools'
    $kits = Join-Path $work 'Windows Kits/10'
    $qt = Join-Path $work 'Qt'
    $vc = Join-Path $vs 'VC/Tools/MSVC/14.44.35207'
    $sdk = Join-Path $kits 'bin/10.0.26100.0'
    $pins = [pscustomobject]@{
        msvc = [pscustomobject]@{ directory = '14.44.35207'; files = [pscustomobject]@{} }
        sdk = [pscustomobject]@{ directory = '10.0.26100.0'; files = [pscustomobject]@{} }
        qt = [pscustomobject]@{ runtime = @('Qt6Core.dll', 'platforms/qwindows.dll'); files = [pscustomobject]@{} }
    }
    foreach ($file in @("$vs/VC/Auxiliary/Build/vcvarsall.bat", "$vc/include/vector", "$vc/lib/x64/msvcprt.lib",
            "$sdk/x64/rc.exe", "$kits/Include/10.0.26100.0/ucrt/stdlib.h", "$kits/Include/10.0.26100.0/um/Windows.h",
            "$kits/Lib/10.0.26100.0/ucrt/x64/ucrt.lib", "$kits/Lib/10.0.26100.0/um/x64/kernel32.lib",
            "$qt/mkspecs/win32-msvc/qmake.conf", "$qt/lib/Qt6WebEngineWidgets.lib", "$qt/bin/Qt6Core.dll", "$qt/plugins/platforms/qwindows.dll")) {
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($file))
        [IO.File]::WriteAllText($file, 'fixture')
    }
    $selected = Get-VerifiedToolchain $pins @{ msvc = @($vc); sdk = @($sdk); qt = @($qt) }
    if ($selected.vs -ne $vs -or $selected.kits -ne $kits) { throw 'Incorrect kit roots passed to the build.' }
} finally {
    $env:PATH = $oldPath
    if ($alias -and [IO.Directory]::Exists($alias)) { [IO.Directory]::Delete($alias) }
    [IO.Directory]::Delete($work, $true)
}

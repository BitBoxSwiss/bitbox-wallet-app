# SPDX-License-Identifier: Apache-2.0
# Discovery only. The build receives the selected roots and constructs its own PATH.

function Get-PhysicalDirectory([string] $Path) {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    # Windows PowerShell 5.1 can report a Target for an ordinary directory.
    # Only follow actual reparse points.
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -and $item.Target) {
        $target = @($item.Target)[0]
        if (![IO.Path]::IsPathRooted($target)) { $target = Join-Path $item.Parent.FullName $target }
        return Get-PhysicalDirectory $target
    }
    if (!$item.Parent) { return $item.FullName }
    return Join-Path (Get-PhysicalDirectory $item.Parent.FullName) $item.Name
}

function Find-ToolRoots($Locations, [string] $Command, [string] $Marker) {
    $found = foreach ($path in $Locations) {
        if ($path -and [IO.Directory]::Exists($path) -and [IO.File]::Exists((Join-Path $path $Marker))) {
            Get-PhysicalDirectory $path
        }
    }
    # PATH can point into cmd, bin, or mingw64/bin of the same installation.
    $onPath = foreach ($dir in ($env:PATH -split ';')) {
        $dir = [Environment]::ExpandEnvironmentVariables($dir.Trim('"'))
        # Package manager shims forward to the registered package; they are not tool roots.
        if (!$dir -or $dir -in @("$env:ChocolateyInstall\bin", "$env:SCOOP\shims", "$env:USERPROFILE\scoop\shims") -or
            ![IO.File]::Exists([IO.Path]::Combine($dir, $Command))) { continue }
        $parent = Get-Item -LiteralPath $dir -Force
        while ($parent) {
            if ([IO.File]::Exists((Join-Path $parent.FullName $Marker))) {
                Get-PhysicalDirectory $parent.FullName
                break
            }
            $parent = $parent.Parent
        }
    }
    @($found) + @($onPath) | Where-Object { $_ } | Sort-Object -Unique
}

function Get-RegisteredPath([string] $Key, [string] $Property) {
    (Get-ItemProperty -LiteralPath $Key -Name $Property -ErrorAction SilentlyContinue).$Property
}

function Get-ToolCandidates() {
    $git = @("$env:ProgramFiles\Git", "$env:LOCALAPPDATA\Programs\Git")
    $git += Get-RegisteredPath 'HKLM:\SOFTWARE\GitForWindows' InstallPath
    $git += Get-RegisteredPath 'HKCU:\SOFTWARE\GitForWindows' InstallPath
    # The Chocolatey package moves the archive's mingw64 directory into C:\ProgramData\mingw64.
    $mingw = @('C:\ProgramData\mingw64\mingw64', 'C:\mingw64', 'C:\tools\mingw64',
        "$env:ChocolateyInstall\lib\mingw\tools\install\mingw64")
    if ($env:MINGW_BIN) { $mingw += Split-Path ($env:MINGW_BIN -replace '^/([A-Za-z])/', '${1}:/') }
    $qt = @(Get-Item -Path 'C:\Qt\*\msvc*_64' -ErrorAction SilentlyContinue | ForEach-Object FullName)
    $qt += @($env:QT_ROOT_DIR, $env:QTDIR)
    $node = @("$env:ProgramFiles\nodejs", $env:NVM_SYMLINK)
    if ($env:NVM_HOME) {
        $node += Get-Item "$env:NVM_HOME\v*" -ErrorAction SilentlyContinue | ForEach-Object FullName
    }
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    $vs = @()
    if ([IO.File]::Exists($vswhere)) {
        $vs = @(& $vswhere -products '*' -version '[17.0,18.0)' -property installationPath)
        if ($LASTEXITCODE) { throw "vswhere failed to list installed Visual Studio instances ($LASTEXITCODE)." }
    }
    $vc = foreach ($root in $vs) {
        Get-ChildItem "$root\VC\Tools\MSVC" -Directory -ErrorAction SilentlyContinue | ForEach-Object FullName
    }
    $crt = foreach ($root in $vs) {
        Get-Item "$root\VC\Redist\MSVC\*\x64\Microsoft.VC143.CRT" -ErrorAction SilentlyContinue | ForEach-Object FullName
    }
    $kits = @("${env:ProgramFiles(x86)}\Windows Kits\10")
    $kits += Get-RegisteredPath 'HKLM:\SOFTWARE\Microsoft\Windows Kits\Installed Roots' KitsRoot10
    $kits += Get-RegisteredPath 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows Kits\Installed Roots' KitsRoot10
    $sdk = foreach ($root in ($kits | Where-Object { $_ } | Sort-Object -Unique)) {
        Get-Item "$root\bin\10.*" -ErrorAction SilentlyContinue | ForEach-Object FullName
    }
    @{
        git = @(Find-ToolRoots $git git.exe cmd/git.exe)
        go = @(Find-ToolRoots @("$env:ProgramFiles\Go", 'C:\Go', $env:GOROOT) go.exe bin/go.exe)
        node = @(Find-ToolRoots $node node.exe node.exe)
        mingw = @(Find-ToolRoots $mingw gcc.exe bin/gcc.exe)
        qt = @(Find-ToolRoots $qt qmake.exe bin/qmake.exe)
        msvc = @(Find-ToolRoots $vc cl.exe bin/Hostx64/x64/cl.exe)
        redist = @($crt | Where-Object { $_ } | ForEach-Object { Get-PhysicalDirectory $_ } | Sort-Object -Unique)
        sdk = @(Find-ToolRoots $sdk rc.exe x64/rc.exe)
    }
}

function Test-ToolFiles($Pin, [string] $Root) {
    if ($Pin.PSObject.Properties['commands']) {
        foreach ($command in $Pin.commands) {
            if (![IO.File]::Exists((Join-Path $Root $command))) { return "missing $command" }
        }
    }
    if (!$Pin.PSObject.Properties['files']) { return }
    foreach ($file in $Pin.files.PSObject.Properties) {
        $path = Join-Path $Root $file.Name
        if (![IO.File]::Exists($path)) { return "missing $($file.Name)" }
        $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        if ($hash -ne $file.Value) {
            $version = [Diagnostics.FileVersionInfo]::GetVersionInfo($path).FileVersion
            $detail = if ($version) { "version $version" } else { "SHA-256 $hash" }
            return "$($file.Name) ($detail) differs from the pinned distribution"
        }
    }
}

function Select-ToolRoot([string] $Name, $Pin, [string[]] $Locations) {
    foreach ($root in $Locations) {
        try { $problem = Test-ToolFiles $Pin $root }
        catch { $problem = $_.Exception.Message }
        if ($problem) {
            Write-Host "  $Name at $root ($problem)"
            continue
        }
        $label = if ($Pin.PSObject.Properties['version']) { "$Name $($Pin.version)" } else { $Name }
        Write-Host "[OK] $label at $root"
        return $root
    }
    Write-Host "[REQUIRED] $($Pin.install)  $($Pin.url)"
    if ($Name -eq 'mingw') {
        Write-Host '  Run in an administrator PowerShell window'
        Write-Host "  choco upgrade mingw --version=$($Pin.version) --allow-downgrade"
    }
}

function Get-VerifiedToolchain($Pins, $Candidates) {
    $selected = @{}
    foreach ($property in $Pins.PSObject.Properties) {
        $name = $property.Name
        $root = Select-ToolRoot $name $property.Value $Candidates[$name]
        if ($root) { $selected[$name] = $root }
    }
    if ($selected.Count -ne $Pins.PSObject.Properties.Name.Count) {
        throw 'Resolve the listed dependencies manually and run the check again.'
    }

    $vc = Get-Item -LiteralPath $selected.msvc -Force
    # The selected directory is <VS>/VC/Tools/MSVC/<toolset>.
    $vs = $vc.Parent.Parent.Parent.Parent.FullName
    if ($vc.Name -ne $Pins.msvc.directory) { throw "Expected the toolset in VC\Tools\MSVC\$($Pins.msvc.directory)." }
    $sdk = Get-Item -LiteralPath $selected.sdk -Force
    if ($sdk.Name -ne $Pins.sdk.directory) { throw "Expected the SDK in bin\$($Pins.sdk.directory)." }
    $selected.vs = $vs
    $selected.kits = $sdk.Parent.Parent.FullName
    $required = @(
        "$vs/VC/Auxiliary/Build/vcvarsall.bat", "$($vc.FullName)/include/vector", "$($vc.FullName)/lib/x64/msvcprt.lib",
        "$($selected.kits)/Include/$($sdk.Name)/ucrt/stdlib.h", "$($selected.kits)/Include/$($sdk.Name)/um/Windows.h",
        "$($selected.kits)/Lib/$($sdk.Name)/ucrt/x64/ucrt.lib", "$($selected.kits)/Lib/$($sdk.Name)/um/x64/kernel32.lib",
        "$($selected.qt)/mkspecs/win32-msvc/qmake.conf", "$($selected.qt)/lib/Qt6WebEngineWidgets.lib"
    )
    foreach ($file in $Pins.qt.runtime) {
        $subdir = if ($file.Contains('/')) { 'plugins' } else { 'bin' }
        $required += Join-Path $selected.qt "$subdir/$file"
    }
    $missing = @($required | Where-Object { ![IO.File]::Exists($_) })
    if ($missing) { throw "Repair the incomplete development kits. Missing files: $($missing -join ', ')." }
    return $selected
}

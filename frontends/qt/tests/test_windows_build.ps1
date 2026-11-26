# SPDX-License-Identifier: Apache-2.0
$ErrorActionPreference = 'Stop'
# Load the preflight functions without provisioning or running the Windows toolchain.
. "$PSScriptRoot/../windows-toolchain.ps1"
. "$PSScriptRoot/../windows-build-helpers.ps1"
function Expect-Failure([scriptblock] $Action, [string] $Message) {
    try { & $Action } catch {
        if ($_.Exception.Message -notlike $Message) { throw }
        return
    }
    throw "Expected failure: $Message"
}
$work = Join-Path ([IO.Path]::GetTempPath()) ('bitbox build test ' + [guid]::NewGuid())
[void][IO.Directory]::CreateDirectory($work)
try {
    # A checkout elsewhere is rejected before tool discovery or build cleanup.
    Expect-Failure { Test-CheckoutLocation $work 'C:\bitbox-wallet-app' } '*physical checkout at C:\bitbox-wallet-app*'

    if ($env:OS -eq 'Windows_NT') {
        # A real directory is accepted, but a junction to it cannot stand in for the required path.
        $checkout = [IO.Directory]::CreateDirectory("$work/checkout").FullName
        [IO.File]::WriteAllText("$checkout/APP_VERSION", '1.0.0')
        Test-CheckoutLocation $checkout $checkout
        $alias = Join-Path $work 'checkout-alias'
        [void](New-Item -ItemType Junction -Path $alias -Target $checkout)
        try {
            Expect-Failure { Test-CheckoutLocation $alias $alias } '*physical checkout*'
        } finally { [IO.Directory]::Delete($alias) }
    }

    Invoke-Native git @('-C', $work, 'init', '--quiet')
    [IO.File]::WriteAllText("$work/.gitattributes", "* text=auto eol=lf`n")
    [IO.File]::WriteAllText("$work/source.txt", "original`n")
    Invoke-Native git @('-C', $work, 'add', '.gitattributes', 'source.txt')

    # Valid local edits are accepted and remain untouched by preflight.
    [IO.File]::WriteAllText("$work/source.txt", "edited`n")
    Test-BuildCheckout git $work
    if ([IO.File]::ReadAllText("$work/source.txt") -cne "edited`n") { throw 'Local edit changed.' }

    # Git can consider CRLF conversion clean; preflight still rejects the changed input bytes.
    [IO.File]::WriteAllText("$work/source.txt", "original`r`n")
    Expect-Failure { Test-BuildCheckout git $work } '*Unexpected line endings*source.txt*'
    [IO.File]::WriteAllText("$work/source.txt", "original`n")

    # Existing CRLF blobs stay valid under text=auto eol=lf; converting them to LF is rejected.
    [IO.File]::WriteAllText("$work/crlf.txt", "original`r`n")
    $crlfBlob = Invoke-Native git @('-C', $work, 'hash-object', '-w', '--no-filters', 'crlf.txt')
    Invoke-Native git @('-C', $work, 'update-index', '--add', '--cacheinfo', "100644,$crlfBlob,crlf.txt")
    Test-BuildCheckout git $work
    [IO.File]::WriteAllText("$work/crlf.txt", "original`n")
    Expect-Failure { Test-BuildCheckout git $work } '*Unexpected line endings*crlf.txt*'
    [IO.File]::WriteAllText("$work/crlf.txt", "original`r`n")

    # A missing submodule reports setup instructions without populating or changing the checkout.
    [IO.File]::WriteAllText("$work/.gitmodules", "[submodule `"module`"]`npath = module`nurl = unused`n")
    Invoke-Native git @('-C', $work, 'update-index', '--add', '--cacheinfo', '160000,0000000000000000000000000000000000000001,module')
    Expect-Failure { Test-BuildCheckout git $work } '*Missing submodule*submodule update --init --recursive*'
    if (Test-Path "$work/module") { throw 'Preflight created a submodule.' }

    # Initialized submodules accept both LF and CRLF source files.
    [void][IO.Directory]::CreateDirectory("$work/module")
    Invoke-Native git @('-C', "$work/module", 'init', '--quiet')
    [IO.File]::WriteAllText("$work/module/source.txt", "original`n")
    Invoke-Native git @('-C', "$work/module", 'add', 'source.txt')
    Test-BuildCheckout git $work
    [IO.File]::WriteAllText("$work/module/source.txt", "original`r`n")
    Test-BuildCheckout git $work

    # Deployment accepts the recorded runtime set and rejects missing or additional binaries.
    $pins = [pscustomobject]@{
        qt = [pscustomobject]@{ runtime = @('Qt6Core.dll') }
        redist = [pscustomobject]@{ files = [pscustomobject]@{ 'vcruntime140.dll' = '' } }
    }
    $tools = @{ qt = 'fixture Qt' }
    $payload = [IO.Directory]::CreateDirectory("$work/payload").FullName
    foreach ($file in @('BitBox.exe', 'libserver.dll', 'breez_sdk_spark_bindings.dll', 'Qt6Core.dll', 'vcruntime140.dll')) {
        [IO.File]::WriteAllText("$payload/$file", 'fixture')
    }
    Test-DeployedBinaries $payload
    [IO.File]::WriteAllText("$payload/extra.dll", 'fixture')
    Expect-Failure { Test-DeployedBinaries $payload } '*Qt deployment differs*'
    Remove-Item "$payload/extra.dll", "$payload/Qt6Core.dll"
    Expect-Failure { Test-DeployedBinaries $payload } '*Qt deployment differs*'
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force
}

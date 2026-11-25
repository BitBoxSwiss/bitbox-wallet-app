# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

# Git Bash converts the verified Windows PATH at this boundary. Recursive Make uses
# the same pinned GNU Make and Bash; developer-shell settings cannot select other tools.
export PATH
PATH=$("$BITBOX_GIT_BIN/cygpath.exe" -pu "${BITBOX_COMPILE_PATH:?Use make qt-windows}")
cd "$(dirname "$0")"
windows=build/windows
# Keep quotes in MAKE for recursive recipes when its installation path contains spaces.
build_make=("$BITBOX_WINDOWS_MAKE" "MAKE=\"$BITBOX_WINDOWS_MAKE\"" SHELL=bash.exe)
"${build_make[@]}" -C ../.. check-go-vendor
"${build_make[@]}" -C ../.. buildweb
# windeployqt can leave files from earlier deployments in the output directory.
rm -rf "$windows"
mkdir -p "$windows"
bash ./genassets.sh "$windows/assets.rcc"
server_out=$(cygpath --absolute --mixed build)
"${build_make[@]}" -C server/ windows-legacy SERVER_OUT="$server_out"
# Disable Git Bash path rewriting for cmd's /d and /c switches.
# /d skips AutoRun hooks; /c exits after the batch file.
# Clear GNU Make's recursive flags before entering NMake.
MSYS2_ARG_CONV_EXCL='*' env -u MAKE -u MAKEFLAGS cmd.exe /d /c compile_windows.bat
cp build/libserver.dll "$windows/"
cp ../../vendor/github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/windows-amd64/breez_sdk_spark_bindings.dll "$windows/"
# The Qt kit supplies its own Microsoft D3D compiler. Host Windows versions can differ.
cp "$BITBOX_QT_BIN/d3dcompiler_47.dll" "$windows/D3Dcompiler_47.dll"
# windows-archive.ps1 excludes installed plug-ins outside the manifest's runtime list.
"$BITBOX_QT_BIN/windeployqt.exe" --qtpaths "$BITBOX_QT_BIN/qtpaths.exe" \
    --release --no-patchqt --no-compiler-runtime --no-system-d3d-compiler --exclude-plugins "$BITBOX_QT_EXCLUDE_PLUGINS" \
    --no-system-dxc-compiler "$windows/BitBox.exe"

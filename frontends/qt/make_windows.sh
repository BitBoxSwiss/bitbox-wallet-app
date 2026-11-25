# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

# windeployqt can leave files from earlier deployments in the output directory.
rm -rf build/windows
mkdir -p build/windows
bash ./genassets.sh build/windows/assets.rcc
server_out=$(cygpath --absolute --mixed build)
make -C server/ windows-legacy SERVER_OUT="$server_out"
# Disable Git Bash path rewriting for cmd's /d and /c switches.
# /d skips AutoRun hooks; /c exits after the batch file.
# Clear GNU Make's recursive flags before entering NMake.
MSYS2_ARG_CONV_EXCL='*' env -u MAKE -u MAKEFLAGS cmd.exe /d /c compile_windows.bat
cp build/libserver.dll build/windows/
cp ../../vendor/github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/windows-amd64/breez_sdk_spark_bindings.dll build/windows/
windeployqt build/windows/BitBox.exe

APP_VERSION="$(tr -d '\r\n' < ../../APP_VERSION)"
archive="build/BitBox-${APP_VERSION}-win64-build.tar.gz"
tmp_archive=$(mktemp "${archive}.XXXXXXXX")
trap 'rm -f "$tmp_archive"' EXIT
tar -czf "$tmp_archive" \
    setup.nsi sign-windows-release.py \
    -C "$PWD/resources/win" icon.ico \
    -C "$PWD/../.." APP_VERSION \
    -C "$PWD/build" windows
mv -f "$tmp_archive" "$archive"
echo "Created $archive"
if [[ ${WINDOWS_INSTALLER:-0} == 1 ]]; then
    makensis -DVERSION="${APP_VERSION}.0" \
        -DBINDIR='build\windows' \
        -DICONFILE='resources\win\icon.ico' \
        setup.nsi
fi

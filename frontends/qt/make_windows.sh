# SPDX-License-Identifier: Apache-2.0

set -e

output=${1:-installer}
if [[ "$output" != installer && "$output" != archive ]]; then
    echo "Usage: $0 [installer|archive]" >&2
    exit 1
fi

# windeployqt can leave files from earlier deployments in the output directory.
rm -rf build/windows
mkdir -p build/windows
bash ./genassets.sh
make -C server/ windows-legacy
env -u MAKE -u MAKEFLAGS cmd "/C compile_windows.bat"
cp build/assets.rcc build/windows/
cp server/libserver.dll build/windows/
cp ../../vendor/github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/windows-amd64/breez_sdk_spark_bindings.dll build/windows/
windeployqt build/windows/BitBox.exe

APP_VERSION="$(tr -d '\r\n' < ../../APP_VERSION)"
if [[ "$output" == archive ]]; then
    archive="build/BitBox-${APP_VERSION}-win64-build.tar.gz"
    tmp_archive=$(mktemp "${archive}.XXXXXXXX")
    trap 'rm -f "$tmp_archive"' EXIT
    tar -czf "$tmp_archive" \
        setup.nsi \
        -C "$PWD/resources/win" icon.ico \
        -C "$PWD/../.." APP_VERSION \
        -C "$PWD/build" windows
    mv -f "$tmp_archive" "$archive"
    echo "Created $archive"
    exit 0
fi

makensis -DVERSION="${APP_VERSION}.0" \
    -DBINDIR='build\windows' \
    -DICONFILE='resources\win\icon.ico' \
    setup.nsi

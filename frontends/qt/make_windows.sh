# SPDX-License-Identifier: Apache-2.0

set -e

mkdir -p build
bash ./genassets.sh
make -C server/ windows-legacy
env -u MAKE -u MAKEFLAGS cmd "/C compile_windows.bat"
cp build/assets.rcc build/windows/
cp server/libserver.dll build/windows/
cp ../../vendor/github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/windows-amd64/breez_sdk_spark_bindings.dll build/windows/
windeployqt build/windows/BitBox.exe

APP_VERSION="$(cat ../../APP_VERSION)"
makensis -DVERSION="${APP_VERSION}.0" setup.nsi

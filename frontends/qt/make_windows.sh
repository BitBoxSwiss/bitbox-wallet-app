# Copyright 2018 Shift Devices AG
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

mkdir -p build
bash ./genassets.sh
make -C server/ windows-legacy
env -u MAKE -u MAKEFLAGS cmd "/C compile_windows.bat"
cp build/assets.rcc build/windows/
cp server/libserver.dll build/windows/
cp ../../vendor/github.com/breez/breez-sdk-go/breez_sdk/lib/windows-amd64/breez_sdk_bindings.dll build/windows/
windeployqt build/windows/BitBox.exe
cp "$MINGW_BIN/libssp-0.dll" build/windows/

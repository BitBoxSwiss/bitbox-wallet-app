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

./genassets.sh
cp build/assets.rcc build/windows/
cp server/libserver.dll build/windows/
windeployqt build/windows/BitBox.exe
cp /c/Program\ Files\ \(x86\)/Microsoft\ Visual\ Studio/2017/Community/VC/Redist/MSVC/14.14.26405/x64/Microsoft.VC141.CRT/msvcp140.dll build/windows/
cp "/c/Program Files (x86)/Microsoft Visual Studio/2017/Community/VC/Redist/MSVC/14.14.26405/x64/Microsoft.VC141.CRT/vccorlib140.dll" build/windows/
cp "/c/Program Files (x86)/Microsoft Visual Studio/2017/Community/VC/Redist/MSVC/14.14.26405/x64/Microsoft.VC141.CRT/vcruntime140.dll" build/windows/
cp $MINGW_BIN/libssp-0.dll build/windows/
makensis setup.nsi

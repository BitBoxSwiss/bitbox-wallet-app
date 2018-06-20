./genassets.sh
cp build/assets.rcc build/windows/
cp server/libserver.dll build/windows/
windeployqt build/windows/BitBox.exe
cp /c/Program\ Files\ \(x86\)/Microsoft\ Visual\ Studio/2017/Community/VC/Redist/MSVC/14.14.26405/x64/Microsoft.VC141.CRT/msvcp140.dll build/windows/
cp "/c/Program Files (x86)/Microsoft Visual Studio/2017/Community/VC/Redist/MSVC/14.14.26405/x64/Microsoft.VC141.CRT/vccorlib140.dll" build/windows/
cp "/c/Program Files (x86)/Microsoft Visual Studio/2017/Community/VC/Redist/MSVC/14.14.26405/x64/Microsoft.VC141.CRT/vcruntime140.dll" build/windows/

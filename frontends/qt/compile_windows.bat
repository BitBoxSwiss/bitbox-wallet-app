:: Compiles the Qt app. Part of `make windows`, which also compiles/bundles the deps

call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
cd build
qmake ..\BitBox.pro
nmake
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_1.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_2.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_atomic_wait.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_codecvt_ids.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\vccorlib140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\vcruntime140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\vcruntime140_1.dll" windows\

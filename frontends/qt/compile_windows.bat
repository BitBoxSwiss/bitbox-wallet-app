:: Compiles the Qt5 app. Part of `make windows`, which also compiles/bundles the deps

call "C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\VC\Auxiliary\Build\vcvars64.bat"
cd build
qmake ..\BitBox.pro
nmake
COPY "%VCToolsRedistDir%\x64\Microsoft.VC141.CRT\msvcp140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC141.CRT\vccorlib140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC141.CRT\vcruntime140.dll" windows\

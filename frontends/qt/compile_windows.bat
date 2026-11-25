:: Compiles the Qt app. Part of `make windows`, which also compiles/bundles the deps
:: Explicit exits report failures to the caller instead of continuing after errors.

call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" || exit /b 1
cd build || exit /b 1
qmake ..\BitBox.pro || exit /b 1
nmake || exit /b 1
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140.dll" windows\ || exit /b 1
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_1.dll" windows\ || exit /b 1
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_2.dll" windows\ || exit /b 1
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_atomic_wait.dll" windows\ || exit /b 1
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_codecvt_ids.dll" windows\ || exit /b 1
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\vccorlib140.dll" windows\ || exit /b 1
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\vcruntime140.dll" windows\ || exit /b 1
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\vcruntime140_1.dll" windows\ || exit /b 1

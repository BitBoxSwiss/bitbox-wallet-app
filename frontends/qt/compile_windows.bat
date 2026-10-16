:: Compiles the Qt app. Part of `make windows`, which also compiles/bundles the deps

call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
cd build
set "CSD_CMAKE=cmake"
where cmake >nul 2>nul
if errorlevel 1 set "CSD_CMAKE=%VSINSTALLDIR%Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
for /f "delims=" %%i in ('qmake -query QT_INSTALL_PREFIX') do set "CSD_QT_ROOT=%%i"
"%CSD_CMAKE%" -S ..\external\qwindowkit -B qwindowkit\build -G "NMake Makefiles" -DCMAKE_PREFIX_PATH="%CSD_QT_ROOT%" -DCMAKE_INSTALL_PREFIX="%CD%\qwindowkit\install" -DCMAKE_INSTALL_LIBDIR=lib -DCMAKE_BUILD_TYPE=Release -DQWINDOWKIT_BUILD_STATIC=ON -DQWINDOWKIT_BUILD_QUICK=OFF -DQWINDOWKIT_ENABLE_STYLE_AGENT=OFF
if errorlevel 1 exit /b 1
"%CSD_CMAKE%" --build qwindowkit\build
if errorlevel 1 exit /b 1
"%CSD_CMAKE%" --install qwindowkit\build
if errorlevel 1 exit /b 1
qmake ..\BitBox.pro
if errorlevel 1 exit /b 1
nmake
if errorlevel 1 exit /b 1
if not exist windows\doc\QWindowKit mkdir windows\doc\QWindowKit
COPY ..\external\qwindowkit\LICENSE windows\doc\QWindowKit\
COPY ..\external\qwindowkit\BITBOX-DEPENDENCY.md windows\doc\QWindowKit\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_1.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_2.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_atomic_wait.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\msvcp140_codecvt_ids.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\vccorlib140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\vcruntime140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC143.CRT\vcruntime140_1.dll" windows\

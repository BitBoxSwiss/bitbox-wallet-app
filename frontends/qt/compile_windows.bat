:: Compiles the Qt app. Part of `make windows`, which also compiles/bundles the deps
:: Run from frontends/qt.
:: Explicit exits report failures to the caller instead of continuing after errors.
call "%BITBOX_VS_ROOT%\VC\Auxiliary\Build\vcvarsall.bat" amd64 %BITBOX_SDK_VERSION% -vcvars_ver=%BITBOX_VC_VERSION% || exit /b 1
if /i not "%VCToolsVersion%"=="%BITBOX_VC_VERSION%" exit /b 1
if /i not "%WindowsSDKVersion%"=="%BITBOX_SDK_VERSION%\" exit /b 1
:: vcvarsall also adds unversioned tools and install paths. qmake and its generated
:: makefiles must resolve cl, link, rc, headers and libraries from the verified kits.
set "PATH=%BITBOX_COMPILE_PATH%"
set "INCLUDE=%BITBOX_INCLUDE%"
set "LIB=%BITBOX_LIB%"
set "LIBPATH="
set "VCINSTALLDIR=%BITBOX_VS_ROOT%\VC\"
set "VCToolsInstallDir=%VCINSTALLDIR%Tools\MSVC\%BITBOX_VC_VERSION%\"
set "WindowsSdkDir=%BITBOX_SDK_ROOT%\"
set "UniversalCRTSdkDir=%WindowsSdkDir%"
set "WindowsSdkVerBinPath=%WindowsSdkDir%bin\%BITBOX_SDK_VERSION%\"
set "QMAKE=%BITBOX_QT_BIN%\qmake.exe"
set "NMAKE=%BITBOX_VC_BIN%\nmake.exe"
set "CRT=%BITBOX_CRT%"

cd build || exit /b 1
"%QMAKE%" ..\BitBox.pro -spec win32-msvc || exit /b 1
"%NMAKE%" || exit /b 1
COPY "%CRT%\msvcp140.dll" windows\ || exit /b 1
COPY "%CRT%\msvcp140_1.dll" windows\ || exit /b 1
COPY "%CRT%\msvcp140_2.dll" windows\ || exit /b 1
COPY "%CRT%\msvcp140_atomic_wait.dll" windows\ || exit /b 1
COPY "%CRT%\msvcp140_codecvt_ids.dll" windows\ || exit /b 1
COPY "%CRT%\vccorlib140.dll" windows\ || exit /b 1
COPY "%CRT%\vcruntime140.dll" windows\ || exit /b 1
COPY "%CRT%\vcruntime140_1.dll" windows\ || exit /b 1

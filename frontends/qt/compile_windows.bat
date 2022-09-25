:: Compiles the Qt5 app. Part of `make windows`, which also compiles/bundles the deps

setlocal
set varsbat="C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
if exist %varsbat% (goto :CALL_VC_VARS_BAT)
echo Trying to figure out Visual Studio 2019 location...
for /f "tokens=2* eol=," %%a in ('reg query "HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Classes\CLSID\{2E1517DA-87BF-4443-984A-D2BF18F5A908}\DefaultIcon" ^|findstr /rc:"REG_SZ *"') do set varsbat=%%~b
If Defined varsbat (
  set varsbat="%varsbat:common7\ide\devenv.exe,1200=VC\Auxiliary\Build\vcvars64.bat%"
)
if exist %varsbat% (goto :CALL_VC_VARS_BAT)
echo Trying to figure out Visual Studio 2022 location...
for /f "tokens=2* eol=," %%a in ('reg query "HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Classes\CLSID\{33ABD590-0400-4FEF-AF98-5F5A8A99CFC3}\DefaultIcon" ^|findstr /rc:"REG_SZ *"') do set varsbat=%%~b
If Defined varsbat (
  set varsbat="%varsbat:common7\ide\devenv.exe,1200=VC\Auxiliary\Build\vcvars64.bat%"
)
:CALL_VC_VARS_BAT
call %varsbat%

cd build
qmake ..\BitBox.pro
nmake
COPY "%VCToolsRedistDir%\x64\Microsoft.VC142.CRT\msvcp140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC142.CRT\msvcp140_1.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC142.CRT\msvcp140_2.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC142.CRT\msvcp140_atomic_wait.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC142.CRT\msvcp140_codecvt_ids.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC142.CRT\vccorlib140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC142.CRT\vcruntime140.dll" windows\
COPY "%VCToolsRedistDir%\x64\Microsoft.VC142.CRT\vcruntime140_1.dll" windows\
endlocal

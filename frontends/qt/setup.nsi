# Copyright 2021 Shift Crypto AG
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

Name "BitBoxApp"

# Need admin privileges for writing to $PROGRAMFILES64 and HKLM.
# Unfortunately, the installer mixes per-user and system-wide things.
# TODO: Switch to per-user install and drop admin execution level.
RequestExecutionLevel admin
SetCompressor /SOLID lzma

# General Symbol Definitions
!define REGKEY "SOFTWARE\$(^Name)"
!define VERSION 4.46.3.0
!define COMPANY "Shift Crypto AG"
!define URL https://github.com/BitBoxSwiss/bitbox-wallet-app/releases/
!define BINDIR "build\windows"
!define ICONDIR "resources\win"
!define APP_EXE "BitBox.exe"
!define AOPP_EXE "$\"$INSTDIR\${APP_EXE}$\" $\"%1$\""

# MUI Symbol Definitions
!define MUI_ICON "${ICONDIR}\icon.ico"
!define MUI_WELCOMEFINISHPAGE_UNICON "${ICONDIR}\icon.ico"
!define MUI_HEADERIMAGE "${ICONDIR}\icon.ico"
!define MUI_HEADERIMAGE_RIGHT "${ICONDIR}\icon.ico"
!define MUI_HEADERIMAGE_UNICON "${ICONDIR}\icon.ico"
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_STARTMENUPAGE_REGISTRY_ROOT HKLM
!define MUI_STARTMENUPAGE_REGISTRY_KEY ${REGKEY}
!define MUI_STARTMENUPAGE_REGISTRY_VALUENAME StartMenuGroup
!define MUI_STARTMENUPAGE_DEFAULTFOLDER "BitBox"
!define MUI_FINISHPAGE_RUN "$WINDIR\explorer.exe"
!define MUI_FINISHPAGE_RUN_PARAMETERS "$INSTDIR\${APP_EXE}"
!define MUI_UNICON "${ICONDIR}\icon.ico"
!define MUI_UNWELCOMEFINISHPAGE_UNICON "${ICONDIR}\icon.ico"
!define MUI_UNFINISHPAGE_NOAUTOCLOSE

# Included files
!include Sections.nsh
!include MUI2.nsh
!include x64.nsh

# Variables
Var StartMenuGroup

# Installer pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_STARTMENU Application $StartMenuGroup
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

# Installer languages
!insertmacro MUI_LANGUAGE English

# Installer attributes
OutFile BitBox-installer.exe
InstallDir $PROGRAMFILES64\BitBox
CRCCheck on
XPStyle on
BrandingText " "
ShowInstDetails show
VIProductVersion ${VERSION}
VIAddVersionKey ProductName "BitBoxApp"
VIAddVersionKey ProductVersion "${VERSION}"
VIAddVersionKey CompanyName "${COMPANY}"
VIAddVersionKey CompanyWebsite "${URL}"
VIAddVersionKey FileVersion "${VERSION}"
VIAddVersionKey FileDescription ""
VIAddVersionKey LegalCopyright ""
InstallDirRegKey HKCU "${REGKEY}" Path
ShowUninstDetails show

# Installer sections
Section -Main SEC0000
    # Finds if there is an open window with name BitBoxApp
    # If found, prompts user to close the window then quits installer
    FindWindow $0 "" "BitBoxApp"
    StrCmp $0 0 notRunning
        MessageBox MB_OK|MB_ICONEXCLAMATION "BitBoxApp is running. Please close it first and restart the installer." /SD IDOK
        Quit
    notRunning:

    SetOutPath $INSTDIR
    SetOverwrite on
    File /r "build\windows\*"
    SetOutPath $INSTDIR\daemon
    SetOutPath $INSTDIR\doc
    #File /r /x Makefile* @abs_top_srcdir@/doc\*.*
    SetOutPath $INSTDIR
    WriteRegStr HKCU "${REGKEY}\Components" Main 1

    # Create a shortcut on the desktop
    CreateShortCut "$DESKTOP\$(^Name).lnk" "$INSTDIR\${APP_EXE}" "" "" 0
SectionEnd

Section -post SEC0001
    WriteRegStr HKCU "${REGKEY}" Path $INSTDIR
    SetOutPath $INSTDIR
    WriteUninstaller $INSTDIR\uninstall.exe
    !insertmacro MUI_STARTMENU_WRITE_BEGIN Application
    CreateDirectory $SMPROGRAMS\$StartMenuGroup
    CreateShortcut "$SMPROGRAMS\$StartMenuGroup\$(^Name).lnk" "$INSTDIR\${APP_EXE}"
    CreateShortcut "$SMPROGRAMS\$StartMenuGroup\Uninstall $(^Name).lnk" $INSTDIR\uninstall.exe
    !insertmacro MUI_STARTMENU_WRITE_END
    WriteRegStr HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$(^Name)" DisplayName "$(^Name)"
    WriteRegStr HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$(^Name)" DisplayVersion "${VERSION}"
    WriteRegStr HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$(^Name)" Publisher "${COMPANY}"
    WriteRegStr HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$(^Name)" URLInfoAbout "${URL}"
    WriteRegStr HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$(^Name)" DisplayIcon $INSTDIR\uninstall.exe
    WriteRegStr HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$(^Name)" UninstallString $INSTDIR\uninstall.exe
    WriteRegDWORD HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$(^Name)" NoModify 1
    WriteRegDWORD HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$(^Name)" NoRepair 1

    # Links aopp: URI scheme.
    # It links it silently if no other app is registered, to not overwrite.
    # If another app is registered, we ask the user for permission.
    ReadRegStr $0 HKCU "SOFTWARE\Classes\aopp\shell\open\command" ""
    ${If} $0 != "${AOPP_EXE}"
        ${If} $0 == ""
            Goto true
        ${Endif}
        MessageBox MB_YESNO "Do you want to set the BitBoxApp as the default program to handle AOPP (Address Ownership Proof Protocol) links?" IDYES true IDNO false
        true:
            WriteRegStr HKCU "SOFTWARE\Classes\aopp" "" "URL:aopp Protocol"
            WriteRegStr HKCU "SOFTWARE\Classes\aopp" "URL Protocol" ""
            WriteRegStr HKCU "SOFTWARE\Classes\aopp" "DefaultIcon" "$\"$INSTDIR\${APP_EXE},1$\""
            WriteRegStr HKCU "SOFTWARE\Classes\aopp\shell\open\command" "" "${AOPP_EXE}"
        false:
    ${EndIf}
SectionEnd

# Macro for selecting uninstaller sections
!macro SELECT_UNSECTION SECTION_NAME UNSECTION_ID
    Push $R0
    ReadRegStr $R0 HKCU "${REGKEY}\Components" "${SECTION_NAME}"
    StrCmp $R0 1 0 next${UNSECTION_ID}
    !insertmacro SelectSection "${UNSECTION_ID}"
    GoTo done${UNSECTION_ID}
next${UNSECTION_ID}:
    !insertmacro UnselectSection "${UNSECTION_ID}"
done${UNSECTION_ID}:
    Pop $R0
!macroend

# Uninstaller sections
Section /o -un.Main UNSEC0000
    RMDir /r /REBOOTOK $INSTDIR
    DeleteRegValue HKCU "${REGKEY}\Components" Main
SectionEnd

Section -un.post UNSEC0001
    DeleteRegKey HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$(^Name)"
    Delete /REBOOTOK "$SMPROGRAMS\$StartMenuGroup\Uninstall $(^Name).lnk"
    Delete /REBOOTOK "$SMPROGRAMS\$StartMenuGroup\$(^Name).lnk"
    Delete /REBOOTOK "$DESKTOP\$(^Name).lnk"
    Delete /REBOOTOK $INSTDIR\uninstall.exe
    Delete /REBOOTOK $INSTDIR\debug.log
    Delete /REBOOTOK $INSTDIR\db.log
    DeleteRegValue HKCU "${REGKEY}" StartMenuGroup
    DeleteRegValue HKCU "${REGKEY}" Path
    DeleteRegKey /IfEmpty HKCU "${REGKEY}\Components"
    DeleteRegKey /IfEmpty HKCU "${REGKEY}"
    #DeleteRegKey HKCR "@PACKAGE_TARNAME@"

    # Unlinks aopp: URI scheme
    # Delete only if the value points to the BitBoxApp, to not delete another app's registration.
    ReadRegStr $0 HKCU "SOFTWARE\Classes\aopp\shell\open\command" ""
    ${If} $0 == "${AOPP_EXE}"
        DeleteRegKey HKCU "SOFTWARE\Classes\aopp"
    ${EndIf}

    RmDir /REBOOTOK $SMPROGRAMS\$StartMenuGroup
    RmDir /REBOOTOK $INSTDIR
    Push $R0
    StrCpy $R0 $StartMenuGroup 1
    StrCmp $R0 ">" no_smgroup
no_smgroup:
    Pop $R0
SectionEnd

# Uninstaller functions
Function un.onInit
    ReadRegStr $INSTDIR HKCU "${REGKEY}" Path
    !insertmacro MUI_STARTMENU_GETFOLDER Application $StartMenuGroup
    !insertmacro SELECT_UNSECTION Main ${UNSEC0000}
FunctionEnd

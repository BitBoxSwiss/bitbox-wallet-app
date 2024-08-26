The BitBoxApp supports building on X86_64 machines. Building on 32bit
systems may be possible but it is explicitly unsupported. The following
platforms should be viable for development, building, and use of the BitBox
Wallet application.

* Debian: 11 bullseye or newer
* Ubuntu: 20.04+
* Fedora: 36+
* MacOS: 10.13+
* Windows: Windows 7+

## Debian, Ubuntu, and Fedora GNU/Linux with Docker

Install [Docker]
(https://docs.docker.com/install/linux/docker-ce/):

Initialize the Docker image:
`make dockerinit`

Enter the Docker environment:
`make dockerdev`

Within the Docker dev environment, build the QT frontend:
`make qt-linux`

Build artifacts:
* `frontends/qt/build/linux/bitbox-4.0.0-1.x86_64.rpm`
* `frontends/qt/build/linux/bitbox_4.0.0_amd64.deb`
* `frontends/qt/build/linux/BitBox-x86_64.AppImage`

## MacOS

Make sure you have `qt@5/bin`, `go@1.22/bin` and `go/bin` in your PATH, i.e. add to your `.zshrc`

```bash
export PATH="$PATH:/usr/local/opt/qt@5/bin"
export PATH="$PATH:/usr/local/opt/go@1.22/bin"
export PATH="$PATH:$HOME/go/bin"
```

Prepare the MacOS system to have the build environment:
`make osx-init`

Build the QT frontend for MacOS:
`make qt-osx`

Build artifacts:
* `frontends/qt/build/osx/BitBox.app`

### Signing & Notarization

Requires Xcode 10+ and macOS 10.13.6+.

```
$ # Sign with hardened runtime:
$ codesign -f --deep --strict --timestamp -o runtime --entitlements frontends/qt/resources/MacOS/entitlements.plist -s CODESIGN_IDENTITY frontends/qt/build/osx/BitBox.app
$ # Create DMG installer
$ make osx-create-dmg
$ # Notarize
$ xcrun notarytool submit --apple-id "APPLE_ID" --team-id "TEAM_ID" --password "PASSWORD" frontends/qt/build/osx/BitBox_Installer.dmg
$ # Check notarization status
$ xcrun notarytool info --apple-id "APPLE_ID" --team-id "TEAM_ID" --password "PASSWORD" NOTARIZATION_ID
```

If you don't know your TEAM_ID, you can find it in your Apple dev account or with:

```
xcrun altool --list-providers --username "APPLE_ID" --password "PASSWORD"
```

## Windows

The build requires `Microsoft Visual Studio 2019 Community Edition`, with the `MSVC v142 - VS 2019 C++ x64/x86 build tools (Latest)`
individual component.

It also requires `mingw-w64`, `bash` (e.g. `git-bash`), `make`,`go 1.22`, `node@20`, `QT 5.15.2` with `qtwebengine`, `nsis`
and possibly other tools.

Some of the tools are easy to install with `choco`:

    choco install git
    choco install mingw
    choco install nsis
    choco install make

Add a system environment variable `MINGW_BIN` pointing to the bin directory of mingw
(e.g. `/c/MinGW/bin` or `/c/Program Files/Git/mingw64/bin`).

Add to the system environment variable `PATH`:
- Location of `qmake`, e.g. `C:\Qt\5.15.2\msvc2019_64\bin`
- Location of nsis, e.g. `C:\Program Files (x86)\NSIS\Bin`

Build the QT frontend for Windows: `make qt-windows`

Build artifacts:
* `frontends\qt\build\windows\*`

To create the installer, run the NSIS UI, then: compile NSI scripts -> frontend/qt/setup.nsi, or run
`makensis setup.nsi`.

## Android

### Build
Enter the Docker environment: `make dockerdev`

Within the Docker dev environment, build the Android App: `make android`

To update the app icon, execute `frontends/android/mkicon.sh`.
The script isn't run during `make android` build.

Build artifacts:
* `frontends/android/BitBoxApp/app/build/outputs/apk/*`

### Deploy
Adb is required for the deploy, on GNU/Linux install `android-tools-adb`

After connecting the device via USB, it is possible to verify the connection with `adb devices`

Inside `frontends/android` folder: `make deploy-debug`

## iOS

The instructions here are preliminary, as the iOS app is still in development.

To build the app and run it in the simulator:

   cd frontends/ios
   make prepare


Open XCode, load the project in /frontends/ios/BitBoxApp/BitBoxApp.xcodeproj.

In the menu, hit Project->Run (or ⌘R).

### Deploy troubleshooting
If the apk install goes wrong, here are some Android configuration that could help:
* Enable developer options
* Enable install via USB
* Enable USB debugging
* Set USB configuration to charge when the device is connected
* Disable MIUI optimization and restart (for Xiaomi devices)

## Cross compile from GNU/Linux to Windows
It is not currently possible to cross compile the BitBox wallet for Windows.
The `qtwebwidgets` QT module only supports native building on Windows. It is
possible to cross compile `libserver.so` library for Windows from GNU/Linux.

Enter the Docker environment:
`make dockerdev`

Cross compile the library:
`cd frontends/qt/server/ && make windows-cross`

Build artifacts:
* `frontends/qt/server/libserver.dll`
* `frontends/qt/server/libserver.h`

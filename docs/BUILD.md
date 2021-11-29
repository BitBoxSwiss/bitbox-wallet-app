The BitBoxApp supports building on X86_64 machines. Building on 32bit
systems may be possible but it is explicitly unsupported. The following
platforms should be viable for development, building, and use of the BitBox
Wallet application.

* Debian GNU/Linux: Stretch and Buster
* Ubuntu: 14.04, 16.04, 17.10, and 18.04
* Fedora: 26, 27, 28, and 29
* MacOS: 10.13
* Windows: Windows 7, Windows 10

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

Prepare the MacOS system to have the build environment:
`make osx-init`

Build the QT frontend for MacOS:
`make qt-osx`

Build artifacts:
* `frontends/qt/build/osx/BitBox.app`

### Signing & Notarization

Requires Xcode 10+ and macOS 10.13.6+.

```
$ cd frontends/qt/build/osx/
$ # Sign with hardened runtime:
$ codesign -f --deep --strict --timestamp -o runtime --entitlements ../../resources/MacOS/entitlements.plist -s CODESIGN_IDENTITY BitBox.app
$ /usr/bin/ditto -c -k --keepParent BitBox.app BitBox.zip
$ # Notarize
$ xcrun altool --notarize-app --primary-bundle-id "ch.shiftcrypto.bitboxapp" --username "APPLE_ID" --password "PASSWORD" --file BitBox.zip
$ # Check notarization status
$  xcrun altool --notarization-info NOTARIZATION_ID --username "APPLE_ID" --password "PASSWORD"
```

## Windows

The build requires `mingw-w64`, `bash`, `make`, `Microsoft Visual Studio 2019`, `go 1.16`, `node@14`,
`QT 5.15.2` and possibly other tools.

Add a system environment variable `MINGW_BIN` pointing to the bin directory of mingw
(e.g. `/c/MinGW/bin`).

Build the QT frontend for Windows: `make qt-windows`

Build artifacts:
* `frontends\qt\build\windows\*`

To create the installer, run the NSIS UI, then: compile NSI scripts -> frontend/qt/setup.nsi, or run
`makensis setup.nsi`.

## Android

EXPERIMENTAL / ALPHA, do not use in production.

Enter the Docker environment: `make dockerdev`

Within the Docker dev environment, build the Android App: `make android`

The Android Sdk is assumed to be in `/opt/android-sdk`. Use `make android ANDROID_SDK_ROOT=...` to
use a different Sdk location.

To update the app icon, execute `frontends/android/mkicon.sh`.
The script isn't run during `make android` build.

Build artifacts:
* `frontends/android/BitBoxApp/app/build/outputs/apk/*`

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

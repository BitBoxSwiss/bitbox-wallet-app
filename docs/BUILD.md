The BitBoxApp supports building on X86_64 machines. Building on 32bit
systems may be possible but it is explicitly unsupported. The following
platforms should be viable for development, building, and use of the BitBox
Wallet application.

* Debian: 11.6+
* Ubuntu: 22.04+
* Fedora: 36+
* MacOS: 12+
* Windows: Windows 10+

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

Install Go, Qt and create-dmg. Note that qt@6 from homebrew does **not** work as it is missing the
`rcc` tool.

```
# Install Go. Can also use the official installer
brew install go@1.26
brew install create-dmg
# Install Qt. Can also use the official installer.
pip install aqtinstall
aqt list-qt mac desktop --arch 6.8.2
aqt install-qt mac desktop 6.8.2 --modules qtpositioning qtserialport qtwebchannel qtwebengine --outputdir ~/Qt
```

Make sure you have `qt@6/bin`,  `qt@6/libexec`, `go@1.26/bin` and `go/bin` in your PATH, i.e. add to your `.zshrc`:

```bash
export PATH="$PATH:$HOME/Qt/6.8.2/macos/bin"
export PATH="$PATH:$HOME/Qt/6.8.2/macos/libexec"
export PATH="$PATH:/usr/local/opt/go@1.26/bin"
export PATH="$PATH:$HOME/go/bin"
```

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

The build requires `Microsoft Visual Studio 2022 Community Edition`, with the `MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)`
individual component.

It also requires `mingw-w64`, `bash` (e.g. `git-bash`), `make`,`go 1.26`, `node@20`, `QT 6.8.2` with `qtwebengine`, `nsis`
and possibly other tools.

Some of the tools are easy to install with `choco`:

    choco install git
    choco install mingw
    choco install nsis
    choco install make

Add a system environment variable `MINGW_BIN` pointing to the bin directory of mingw
(e.g. `/c/MinGW/bin` or `/c/Program Files/Git/mingw64/bin`).

Add to the system environment variable `PATH`:
- Location of `qmake`, e.g. `C:\Qt\6.8.2\msvc2022_64\bin`
- Location of nsis, e.g. `C:\Program Files (x86)\NSIS\Bin`

Build the QT frontend for Windows: `make qt-windows`

Build artifacts:
* `frontends\qt\build\windows\*`
* `frontends\qt\build\BitBox-installer.exe`

## Android

### Build
Enter the Docker environment: `make dockerdev`

Within the Docker dev environment, build the **debug version** of the Android App: `make android`

To update the app icon, execute `frontends/android/mkicon.sh`.
The script isn't run during `make android` build.

Build artifacts:
* `frontends/android/BitBoxApp/app/build/outputs/apk/*`

### Deploy
Adb is required for the deploy, on GNU/Linux install `android-tools-adb`

After connecting the device via USB, it is possible to verify the connection with `adb devices`

Inside `frontends/android` folder: `make deploy-debug`

### Release build

To assemble the signed release .apk and .aab files, run `make android-assemble-release`.

The keystore file `frontends/android/BitBoxApp/app/bitboxapp.jks` must be present.

Build artifacts:
* `frontends/android/BitBoxApp/app/build/outputs/apk/release/app-release.apk`
* `frontends/android/BitBoxApp/app/build/outputs/bundle/release/app-release.aab`


### Deploy troubleshooting
If the apk install goes wrong, here are some Android configuration that could help:
* Enable developer options
* Enable install via USB
* Enable USB debugging
* Set USB configuration to charge when the device is connected
* Disable MIUI optimization and restart (for Xiaomi devices)

## iOS

The instructions here are preliminary, as the iOS app is still in development.

To build the app and run it in the simulator:

   cd frontends/ios
   make prepare


Open XCode, load the project in /frontends/ios/BitBoxApp/BitBoxApp.xcodeproj.

In the menu, hit Project->Run (or ⌘R).

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

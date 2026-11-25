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

Install Go 1.26.10, Qt and create-dmg. Note that qt@6 from homebrew does **not** work as it is missing the
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
export PATH="$(brew --prefix go@1.26)/bin:$PATH"
export PATH="$PATH:$HOME/go/bin"
```

Build the QT frontend for MacOS:
`make qt-osx`

Build artifacts:
* `frontends/qt/build/osx/BitBox.app`

### Signing & Notarization

Requires Xcode 10+ and macOS 12+.

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

Use 64-bit Windows 10 or 11 (including Home). Install Git Bash and Make with
[Chocolatey](https://chocolatey.org/install) from an administrator PowerShell:

```powershell
choco install git make
```

Clone or move the repository to `C:\bitbox-wallet-app`. The fixed location is required for
reproducible builds. This must be the physical checkout, not a junction or drive alias.
Run the following commands in Git Bash from that directory to initialize the submodules
and check the installed toolchain:

```bash
cd /c/bitbox-wallet-app
git submodule update --init --recursive
make windows-check-toolchain
```

Install or repair any dependencies listed by the check, using its version requirements,
installation links and Chocolatey commands, then run it again. The pins are in
[`windows-toolchain.json`](../frontends/qt/windows-toolchain.json).

Build the archive:

```bash
make qt-windows
```

This checks the toolchain again, clears `frontends\qt\build\`, and builds the current checkout,
including local edits. The application files are in `frontends\qt\build\windows\`, and the archive
is `frontends\qt\build\BitBox-<APP_VERSION>-win64-build.tar.gz`.
CI also packages an installer from the same application files. Local builds do not require NSIS.

### Sign and package on Linux

Copy `frontends\qt\build\BitBox-<APP_VERSION>-win64-build.tar.gz` to the Linux signing machine.

On Debian or Ubuntu, install the packaging tools on the signing machine with apt.

```sh
sudo apt update
sudo apt install python3 nsis osslsigncode 7zip
```

On Linux, set `archive` to the local path of the trusted release archive, then extract it and run
the bundled script.

```sh
work=$(mktemp -d)
tar -xzf "$archive" -C "$work" &&
    python3 "$work/sign-windows-release.py" /path/to/sign-file
```

`sign-file` takes one absolute EXE or DLL path, signs and timestamps it in place, and exits nonzero on failure.
The release script verifies each newly signed file and writes `BitBox-<APP_VERSION>-win64-installer.exe`
to the current directory. The signing machine trusts the Windows build to supply authentic, intact
pre-signed DLLs and EXEs such as `D3Dcompiler_47.dll` and `QtWebEngineProcess.exe`. If `osslsigncode`
can extract a signature from a DLL or EXE in the archive, the script skips signing that file.
NSIS compresses the `windows/` directory into the installer, preserving the embedded signatures.
If NSIS is installed outside `/usr/share/nsis`, set `NSISDIR` to the directory containing `Plugins/`.

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

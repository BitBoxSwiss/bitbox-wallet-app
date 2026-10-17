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

### Desktop decorations

Desktop builds compile the pinned QWindowKit Core/Widgets dependency from
`frontends/qt/external/qwindowkit`. CMake is required alongside qmake. The Linux
image also needs `libwayland-dev`; Qt private Wayland headers must match the Qt
runtime exactly (currently 6.8.2). Dependency pins and the small downstream patch
are recorded in `frontends/qt/external/qwindowkit/BITBOX-DEPENDENCY.md`.

The Qt shell owns window controls, dragging, resizing and cached Linux shadows.
Linux establishes the frameless native surface before attaching QWindowKit's
window-ID hook. Appearance updates use Qt's normal composition scheduling so
WebEngine's first frame does not depend on a resize or a theme change.
The web loading view waits for the selected theme; there is no native startup
redraw or paint-acknowledgement handshake. Later theme changes keep the app mounted.
Scene-color repair keeps the WebEngine
surface transparent across background changes and renderer reloads.
Controls share the app's fixed header; scrolling and desktop banners
start below it. Only occupied left/right control slots reserve space, and one
centering rule aligns the logo, heading, Guide and controls. Standard captions
are 70px high by default. System window borders are the default; existing saved
choices remain respected. Linux's design playground can switch live between
system/Linux captions (following desktop button preferences), simulated macOS
traffic lights on the left, and simulated Windows captions on the right.
These previews retain Linux's native actions; they do not emulate AppKit or Snap
Layouts. An optional separate custom titlebar reserves a controls row above the
app's headings. The web view fills the whole window body, so panel colors,
gradients, dimming and animations extend through this row in the same composition.
There is no duplicate centered title or separately painted titlebar background.
QWindowKit handles dragging within the controls row; web dismiss overlays remain
clickable there. The option switches live when CSD is active. System borders
must be disabled with a restart first.
Header height, button preview and logo visibility persist across themes.
The dedicated desktop Settings > Playground tab contains the experimental controls,
including the system-border option. Gradients are nested under each element
(main content, sidebar, guide, buttons and cards), with indented subsection labels
and a left rule beneath shaded category headers. Shapes, placement, spacing, gradients'
strength/angle, sidebar width, motion and scrollbar effects are shared between
themes; color palettes remain separate. Existing conflicting shared values use
the light profile, retaining any dark-only settings. Sidebar width can also be dragged
at its edge or adjusted with arrow keys, Home and End. Dragging saves on release;
width remains bounded by logo space and the viewport. Mobile stays unchanged.
The centered logo option balances the space between left-side controls and the
sidebar edge, with the configured spacing as minimum padding on each side.
The collapsible live preview uses actual form and settings components with isolated
sample state. Reset-palette clears only the current colors; reset-all clears both palettes and shared settings
and restores the standard 70px header, visible logo, system button style and
system window borders (requiring a restart when CSD is active). The modernized
web design remains available with either decoration mode.
Desktop scrollbars default to square thumbs with no padding. Padding and thumb
corner radius are adjustable; the reserved gutter equals thumb width plus twice
the padding, keeping content stable as scrollbars fade. An optional 1px inset
scrollbar highlight has adjustable opacity and follows the thumb's idle fade.
Linux uses a web alpha mask with 12px corners (with the current 7.5px button
radius) and a 1px inset outline at 5% opacity. An outward-rounded native guard
bounds stale WebEngine frames during resize without cutting the antialiased edge.
Qt paints the cached shadow and a rounded backdrop beneath the web surface;
panel backgrounds and the outline belong entirely to Chromium.
The outline is black in light mode and white in dark mode. Maximized/fullscreen
windows have neither an outline nor rounded corners. Caption-color hit tests
stay inside whole viewport pixels for fractional display scaling. A closed guide
remains hidden across responsive layout changes, including maximization.
The cached shadow is stronger when focused and has more contrast in light mode.
Linux resize targets cover 4px inside the body and 6px into the shadow,
with extended diagonal corner targets and matching cursors. Plain transparent
widgets shield WebEngine at the edges; QWindowKit owns their resize hit test,
cursor and compositor resize request. Windows uses at
least 6 logical pixels, or the system resize thickness when larger.
Wayland input masks include the resize gutter and exclude the rest of the shadow.
Main, sidebar and guide content scroll below their fixed captions. The guide
close control sits left of its title, away from the window close control.
Dimmed caption areas dismiss an open panel; visible panel captions remain
native drag regions. A 5% separator appears below captions only after scrolling.
Scrollable content has no edge treatment by default. The playground effects
section offers the earlier 12px inset and 16px fade as optional shared choices.
The inset shortens each scroll viewport to leave a gap below it; the fade uses
each panel's background and appears only while more content remains below.
Both treatments use CSS; the fade captures no input and disappears at the end.
Caption controls do not take keyboard focus from the web content.

The web UI publishes bounded header geometry and native caption colors in one
WebChannel transaction when both change. Unchanged sections are omitted so
geometry-only updates do not repaint the native appearance. DOM mutations are
coalesced before the next paint; panel transition events publish immediately.
Reloads and viewport changes advance one layout revision; revision and sequence
checks reject stale snapshots. Scroll events update separators and fades locally
without measuring native drag geometry.
Only one transaction can await Qt's reply. While it is pending, additional
measurements are deferred and the latest DOM is sampled after the reply.
Continuous sampling runs only during active panel transitions, for at most one
second; native input handling remains synchronous. Linux follows live
`org.freedesktop.appearance/color-scheme` Settings portal values (0/2 light,
1 dark), unless the app has an explicit theme override. Portal reads support
ReadOne and legacy Read, and are refreshed when the portal restarts.
WebChannel only publishes bounded layout snapshots and appearance/preferences;
never route pointer events through JavaScript, Go or D-Bus. Linux reads window
button preferences through the Settings portal, with bounded `gsettings` or
`kreadconfig6`/`kreadconfig5` fallbacks. Unsupported KDE buttons are omitted.

**Use system window borders** remains available on all desktop systems for testing
and displays a restart reminder when changed. It takes effect after restarting
the app. Modern CSD is the default, including
on macOS and Windows; native decorations requires an explicit opt-in.
`BITBOXAPP_NATIVE_DECORATIONS=1` forces native decorations for troubleshooting. Browser and mobile layouts/transports do not enable this feature.

Launch a desktop test build with `-testnet`. Close an already running BitBoxApp
first: the standard desktop build retains its single-instance identity.

For Linux native regression tests, after building the desktop dependency:

```sh
mkdir -p /tmp/bitbox-chrome-tests
cd /tmp/bitbox-chrome-tests
qmake /path/to/bitbox-wallet-app/frontends/qt/tests/desktopwindow.pro
make -j4
dbus-run-session -- ./desktopwindow-test
```

Run on native Wayland (`QT_QPA_PLATFORM=wayland`) and X11 (`QT_QPA_PLATFORM=xcb`).
The tests use an isolated settings directory and D-Bus session. Headless root
containers additionally need `QTWEBENGINE_DISABLE_SANDBOX=1`; do not use that
override for normal desktop launches. Manual acceptance still covers compositor
dragging/snapping, monitor scaling, shadows and Windows/macOS behavior.

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

It also requires `mingw-w64`, `bash` (e.g. `git-bash`), `make`,`go 1.26`, `node@24`, `QT 6.8.2` with `qtwebengine`, `nsis`
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

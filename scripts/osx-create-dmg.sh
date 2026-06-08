#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

APP="frontends/qt/build/osx/BitBox.app"
INSTALLER="frontends/qt/build/osx/BitBoxApp_Installer.dmg"

if ! type create-dmg > /dev/null; then
    echo "create-dmg not available. Install with Homebrew using 'brew install create-dmg'."
    exit 1
fi

if [ ! -d "$APP" ]; then
	echo "No target found at: $APP"
	exit 1
fi

if [ -f "$INSTALLER" ]; then
    echo "Removing existing installer file: $INSTALLER"
    rm "$INSTALLER"
fi

create-dmg \
	--volname "BitBoxApp Installer" \
	--volicon "frontends/qt/resources/MacOS/icon.icns" \
	--background "frontends/qt/resources/MacOS/background.png" \
	--window-pos 200 120 \
	--window-size 800 450 \
	--icon-size 120 \
	--icon "BitBox.app" 200 190 \
  	--hide-extension "BitBox.app" \
  	--app-drop-link 600 190 \
  	"$INSTALLER" \
  	"$APP"
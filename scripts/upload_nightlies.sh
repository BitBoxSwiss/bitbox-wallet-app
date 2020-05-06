#!/bin/bash

set -e

LINUX_BUILD=$TRAVIS_BUILD_DIR/frontends/qt/build/linux
ANDROID_BUILD=$TRAVIS_BUILD_DIR/frontends/android/BitBoxApp/app/build/outputs/apk/debug
UPLOADS=$TRAVIS_BUILD_DIR/uploads
MACOS_BUILD=frontends/qt/build/osx
UPLOAD_DIR=$1

sudo mkdir $TRAVIS_BUILD_DIR/uploads

if [ "$TRAVIS_OS_NAME" == "linux" ]; then
    for file in $LINUX_BUILD/*;
        do
            # Add the commit hash at the end of every file, before the file extension
            # excluding the .AppImage, since it already has the commit hash
            EXT="${file##*.}"
            if [ $EXT != "AppImage" ]; then
                sudo mv $file $UPLOADS/$(date -I)-$(basename $file ."$EXT")-$(git rev-parse --short HEAD)."$EXT"
            else
                sudo mv $file $UPLOADS/$(date -I)-$(basename $file ."$EXT")."$EXT"
            fi
        done

    # Do the same for the Android apk build
    sudo mv $ANDROID_BUILD/app-debug.apk $UPLOADS/$(date -I)-app-debug-$(git rev-parse --short HEAD).apk

    scp $OPTIONS $UPLOADS/* travis@$DEVSERVER_IP:/var/www/nightlies/$UPLOAD_DIR
fi

if [ "$TRAVIS_OS_NAME" == "osx" ]; then
    cd $MACOS_BUILD
    NEW_ARCHIVE=$(date -I)-BitBox-macOS-$(git rev-parse --short HEAD).zip
    zip -r $NEW_ARCHIVE BitBox.app
    scp $OPTIONS $NEW_ARCHIVE travis@$DEVSERVER_IP:/var/www/nightlies/$UPLOAD_DIR
fi

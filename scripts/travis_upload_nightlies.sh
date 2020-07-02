#!/bin/bash

set -e

# Don't upload anything unless it's a push commit to the master branch.
if [ "$TRAVIS_PULL_REQUEST" != "false" ] || [ "$TRAVIS_BRANCH" != "master" ]; then
    exit 0
fi

openssl aes-256-cbc -K $encrypted_59febc5c238f_key -iv $encrypted_59febc5c238f_iv -in travis_rsa.enc -out travis_rsa -d
chmod 600 travis_rsa
mv travis_rsa ~/.ssh/id_rsa

# See travis-ci.sh script for why macOS build is in a different directory.
MACOS_BUILD=~/go/src/github.com/digitalbitbox/bitbox-wallet-app/frontends/qt/build/osx
LINUX_BUILD=$TRAVIS_BUILD_DIR/frontends/qt/build/linux
ANDROID_BUILD=$TRAVIS_BUILD_DIR/frontends/android/BitBoxApp/app/build/outputs/apk/debug
UPLOADS=$TRAVIS_BUILD_DIR/uploads
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
    NEW_ARCHIVE=$(date '+%Y-%m-%d')-BitBox-macOS-$(git rev-parse --short HEAD).zip
    zip -r $NEW_ARCHIVE BitBox.app
    scp $OPTIONS $NEW_ARCHIVE travis@$DEVSERVER_IP:/var/www/nightlies/$UPLOAD_DIR
fi

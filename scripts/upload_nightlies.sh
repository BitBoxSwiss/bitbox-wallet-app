#!/bin/bash -e

LINUX_BUILD=$TRAVIS_BUILD_DIR/frontends/qt/build/linux
MACOS_BUILD=frontends/qt/build/osx
UPLOAD_DIR=$1

if [ "$TRAVIS_OS_NAME" == "linux" ]; then
    for file in $LINUX_BUILD/*;
        do
            # Add the commit hash at the end of every file, before the file extension
            # excluding the .AppImage, since it already has the commit hash
            EXT="${file##*.}"
            if [ $EXT != "AppImage" ]; then
                sudo mv $file $LINUX_BUILD/$(basename $file ."$EXT")-$(git rev-parse --short HEAD)."$EXT"
            fi
        done
    scp $OPTIONS $LINUX_BUILD/* travis@$DEVSERVER_IP:/var/www/nightlies/$UPLOAD_DIR
fi

if [ "$TRAVIS_OS_NAME" == "osx" ]; then
    cd $MACOS_BUILD
    NEW_ARCHIVE=BitBox-macOS-$(git rev-parse --short HEAD).zip
    zip -r $NEW_ARCHIVE BitBox.app
    scp $OPTIONS $NEW_ARCHIVE travis@$DEVSERVER_IP:/var/www/nightlies/$UPLOAD_DIR
fi

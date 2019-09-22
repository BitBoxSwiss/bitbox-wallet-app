#!/bin/bash -e
if [ "$TRAVIS_OS_NAME" == "linux" ]; then
    docker run -v ${TRAVIS_BUILD_DIR}:/opt/go/src/github.com/digitalbitbox/bitbox-wallet-app/ \
           -i shiftcrypto/bitbox-wallet-app:1 \
           bash -c "make -C \$GOPATH/src/github.com/digitalbitbox/bitbox-wallet-app ci"
    docker run --privileged \
           -v ${TRAVIS_BUILD_DIR}:/opt/go/src/github.com/digitalbitbox/bitbox-wallet-app/ \
           -i shiftcrypto/bitbox-wallet-app:1 \
           bash -c "make -C \$GOPATH/src/github.com/digitalbitbox/bitbox-wallet-app qt-linux"
    docker run --privileged \
           -v ${TRAVIS_BUILD_DIR}:/opt/go/src/github.com/digitalbitbox/bitbox-wallet-app/ \
           -i shiftcrypto/bitbox-wallet-app:1 \
           bash -c "make -C \$GOPATH/src/github.com/digitalbitbox/bitbox-wallet-app android"
fi

if [ "$TRAVIS_OS_NAME" == "osx" ]; then
    export HOMEBREW_NO_AUTO_UPDATE=1
    brew outdated go || brew upgrade go
    brew outdated node || brew upgrade node
    brew install yarn
    brew install qt
    export PATH="/usr/local/opt/qt/bin:$PATH"
    export LDFLAGS="-L/usr/local/opt/qt/lib"
    export CPPFLAGS="-I/usr/local/opt/qt/include"
    export GOPATH=~/go/
    export PATH=$PATH:~/go/bin
    mkdir -p $GOPATH/src/github.com/digitalbitbox/
    cd ../ && mv bitbox-wallet-app $GOPATH/src/github.com/digitalbitbox/
    cd $GOPATH/src/github.com/digitalbitbox/bitbox-wallet-app/
    make envinit
    make qt-osx
fi

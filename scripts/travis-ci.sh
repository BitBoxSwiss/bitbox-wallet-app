#!/bin/bash -e
if [ "$TRAVIS_OS_NAME" == "linux" ]; then
    docker build --tag bitbox-wallet-dev -f Dockerfile .
    docker build --tag bitbox-wallet-ci -f Dockerfile.travis .
    docker run -i bitbox-wallet-ci bash \
        -c "make -C \$GOPATH/src/github.com/digitalbitbox/bitbox-wallet-app ci"
    docker run --privileged -i bitbox-wallet-ci bash \
        -c "make -C \$GOPATH/src/github.com/digitalbitbox/bitbox-wallet-app qt-linux"
fi

if [ "$TRAVIS_OS_NAME" == "osx" ]; then
    brew outdated go || brew upgrade go
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
    make init
    make qt-osx
fi

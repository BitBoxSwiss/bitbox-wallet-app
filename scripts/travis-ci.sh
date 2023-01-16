#!/bin/bash -eux

# Which make target to run.
WHAT="$1"
# Because we need to compile some Go code without modules,
# the source must be placed in a specific directory as expected by Go.
# The path is relative to GOPATH.
# If you change this, remember to update MACOS_BUILD in
# travis_upload_nightlies.sh.
GO_SRC_DIR=src/github.com/digitalbitbox/bitbox-wallet-app

# The following is executed only on linux machines.
if [ "$TRAVIS_OS_NAME" == "linux" ]; then
    # Which docker image to use to run the CI. Defaults to Docker Hub.
    # Overwrite with CI_IMAGE=docker/image/path environment variable.
    # Keep this in sync with .github/workflows/ci.yml.
    : "${CI_IMAGE:=shiftcrypto/bitbox-wallet-app:15}"
    # Time image pull to compare in the future.
    time docker pull "$CI_IMAGE"

    # .gradle dir is mapped to preserve cache.
    #
    # safe.directory is added due to "unsafe repository (REPO is owned by someone else)" in GitHub
    # CI (https://github.com/actions/checkout/issues/760)
    docker run --privileged \
           -v $HOME/.gradle:/root/.gradle \
           -v ${TRAVIS_BUILD_DIR}:/opt/go/${GO_SRC_DIR}/ \
           -i "${CI_IMAGE}" \
           bash -c "git config --global --add safe.directory \$GOPATH/${GO_SRC_DIR} && make -C \$GOPATH/${GO_SRC_DIR} ${WHAT}"
fi

# The following is executed only on macOS machines.
if [ "$TRAVIS_OS_NAME" == "osx" ]; then
    # Go is pre-installed according to the settings in .travis.yml.
    # GitHub CI installs it directly in the macos action, before executing
    # this script.
    go version
    brew install qt@5
    brew install nvm
    source /usr/local/opt/nvm/nvm.sh
    nvm install 14.15.4 # install this node version
    export PATH="/usr/local/opt/qt@5/bin:$PATH"
    export LDFLAGS="-L/usr/local/opt/qt@5/lib"
    export CPPFLAGS="-I/usr/local/opt/qt@5/include"
    export GOPATH=~/go
    export PATH=$PATH:~/go/bin
    mkdir -p $GOPATH/$(dirname $GO_SRC_DIR)
    # GitHub checkout action (git clone) seem to require current work dir
    # to be the root of the repo during its clean up phase. So, we push it
    # here and pop in the end.
    pushd ../ && cp -a bitbox-wallet-app $GOPATH/$(dirname $GO_SRC_DIR)
    cd $GOPATH/$GO_SRC_DIR
    make "$WHAT"
    popd
fi

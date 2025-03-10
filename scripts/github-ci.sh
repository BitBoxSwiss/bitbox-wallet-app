#!/bin/bash -eux

# Which make target to run.
WHAT="$1"
# Because we need to compile some Go code without modules,
# the source must be placed in a specific directory as expected by Go.
# The path is relative to GOPATH.
GO_SRC_DIR=src/github.com/BitBoxSwiss/bitbox-wallet-app

# The following is executed only on linux machines.
if [ "$OS_NAME" == "linux" ]; then
    # Which docker image to use to run the CI. Defaults to Docker Hub.
    # Overwrite with CI_IMAGE=docker/image/path environment variable.
    # Keep this in sync with .github/workflows/ci.yml.
    : "${CI_IMAGE:=shiftcrypto/bitbox-wallet-app:$(cat .containerversion)}"
    # Time image pull to compare in the future.
    time docker pull "$CI_IMAGE"

    # .gradle dir is mapped to preserve cache.
    #
    # safe.directory is added due to "unsafe repository (REPO is owned by someone else)" in GitHub
    # CI (https://github.com/actions/checkout/issues/760)
    docker run --privileged \
           -v $HOME/.gradle:/root/.gradle \
           -v ${GITHUB_BUILD_DIR}:/root/go/${GO_SRC_DIR}/ \
           -i "${CI_IMAGE}" \
           bash -c "git config --global --add safe.directory \$(go env GOPATH)/${GO_SRC_DIR} && make -C \$(go env GOPATH)/${GO_SRC_DIR} ${WHAT}"
fi

# The following is executed only on macOS machines.
if [ "$OS_NAME" == "osx" ]; then
    # GitHub CI installs Go and Qt directly in the macos action, before executing
    # this script.
    go version
    export PATH="~/go/bin:$PATH"
    mkdir -p $(go env GOPATH)/$(dirname $GO_SRC_DIR)
    cp -a ../bitbox-wallet-app $(go env GOPATH)/$(dirname $GO_SRC_DIR)
    make -C $(go env GOPATH)/$GO_SRC_DIR "$WHAT"
fi

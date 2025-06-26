#!/bin/bash -eux
# Which make target to run.
WHAT="$1"
# Because we need to compile some Go code without modules,
# the source must be placed in a specific directory as expected by Go.
# The path is relative to GOPATH.
GO_SRC_DIR=src/github.com/BitBoxSwiss/bitbox-wallet-app

go version
export PATH="~/go/bin:$PATH"
# export GOFLAGS="-buildvcs=false"   # Disable VCS stamping cleanly for all go commands
mkdir -p $(go env GOPATH)/$(dirname $GO_SRC_DIR)
cp -a ../bitbox-wallet-app $(go env GOPATH)/$(dirname $GO_SRC_DIR)
git config --global --add safe.directory $(go env GOPATH)/${GO_SRC_DIR}
make -C $(go env GOPATH)/$GO_SRC_DIR "$WHAT"

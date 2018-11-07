#!/bin/bash -e

# This is like `go get`, but while that always gets `master`, you can provide an additional
# revision/tag/branch.
# The first parameter must be the revision.
# The second parameter must be the package name.
# Example ./go-get v1.12 github.com/golangci/golangci-lint/cmd/golangci-lint


REVISION=$1
shift
go get -u $@
cd "$GOPATH/src/$1"
git checkout "$REVISION"
go install ./...

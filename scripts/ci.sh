#!/bin/bash -e

# use `ci.sh --fast` to only run fast checkers.
if [ "$1" == "--fast" ]; then
    fast="--fast"
else
    fast=""
fi

go build ./...

gometalinter.v1 \
    "$fast" \
    --concurrency 3 \
    --skip=mocks \
    --deadline=600s \
    --vendored-linters \
    --vendor \
    --disable-all \
    --tests \
    --exclude=assets.go \
    --exclude=server.go \
    -E test \
    -E golint \
    -E vet \
    -E vetshadow \
    -E deadcode \
    -E ineffassign \
    -E staticcheck \
    -E unconvert \
    -E unused \
    -E gosimple \
    -E unparam \
    -E misspell \
    -E structcheck \
    -E varcheck \
    -E errcheck \
    ./...

#!/bin/bash -e

gometalinter.v1 \
    --concurrency 3 \
    --skip=mocks \
    --skip=binweb \
    --skip=dbbdesktop \
    --deadline=600s \
    --vendored-linters \
    --vendor \
    --disable-all \
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
    ./...

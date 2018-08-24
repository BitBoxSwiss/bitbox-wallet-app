#!/bin/bash -e
# Copyright 2018 Shift Devices AG
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


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
    --deadline=1200s \
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

#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

set -e
set -x

# Set go-langs data race detector options
export GORACE="halt_on_error=1"
export GOTOOLCHAIN="local"

APP_VERSION="$(cat APP_VERSION)"
GO_LDFLAGS="-X github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo.versionString=${APP_VERSION}"

# This script has to be called from the project root directory.
go build -trimpath -mod=vendor -ldflags "${GO_LDFLAGS}" ./...
go test -race -mod=vendor -ldflags "${GO_LDFLAGS}" ./... -count=1 -v
golangci-lint --version
golangci-lint config verify
golangci-lint run

npm --prefix=frontends/web install # needed to install dev dependencies.
make weblint
npm --prefix=frontends/web test -- --no-color --no-watch
# check that the i18n files are formatted correctly (avoids noisy diff when
# pulling from locize)
if ! locize format frontends/web/src/locales --format json --dry true ; then
    echo "i18n files malformatted. Fix with: make locize-fix"
    exit 1
fi

./scripts/check-locize-placeholders.py

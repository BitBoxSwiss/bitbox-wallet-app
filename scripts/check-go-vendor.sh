#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
check_dir="$(mktemp -d)"
vendor_dir="${check_dir}/vendor"

cleanup() {
    chmod -R u+w "${check_dir}" 2>/dev/null || true
    rm -rf "${check_dir}"
}
trap cleanup EXIT

mkdir -p "${check_dir}/modcache"
(
    cd "${repo_root}"
    # Regenerate from go.sum-authenticated downloads rather than trusting vendor/ or a reused cache.
    GOMODCACHE="${check_dir}/modcache" GOFLAGS="-mod=readonly -modcacherw" \
        go mod vendor -o "${vendor_dir}"
)

if ! git diff --no-index --exit-code --ignore-cr-at-eol -- \
    "${repo_root}/vendor" "${vendor_dir}"; then
    echo "vendor/ does not match the dependencies authenticated by go.sum." >&2
    echo "Run 'make go-vendor' and commit the result." >&2
    exit 1
fi

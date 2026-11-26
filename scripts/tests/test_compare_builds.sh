#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

compare=$(cd "$(dirname "$0")/.." && pwd)/compare-builds.sh
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
mkdir "$work/first" "$work/second"

expect_status() {
    local expected=$1 status=0
    shift
    "$@" > "$work/log" 2>&1 || status=$?
    if [[ $status -ne $expected ]]; then
        cat "$work/log" >&2
        echo "Expected exit $expected, got $status" >&2
        exit 1
    fi
}

pack_second() {
    tar -czf "$work/second.tar.gz" -C "$work/second" .
}

# Archive metadata and compression do not affect the comparison of file contents.
printf 'payload\n' > "$work/first/file"
cp "$work/first/file" "$work/second/file"
tar --mtime=@1 -cf "$work/first archive.tar" -C "$work/first" .
tar --mtime=@2 -czf "$work/second.tar.gz" -C "$work/second" .
expect_status 0 "$compare" "$work/first archive.tar" "$work/second.tar.gz"

# Text line endings are part of the payload, including on Windows.
printf 'payload\r\n' > "$work/second/file"
pack_second
expect_status 1 "$compare" "$work/first archive.tar" "$work/second.tar.gz"

# Binary changes must be reported as differences, without trying to decode them.
printf '\0changed' > "$work/second/file"
pack_second
expect_status 1 "$compare" "$work/first archive.tar" "$work/second.tar.gz"

# Missing and additional files both change the build.
rm "$work/second/file"
pack_second
expect_status 1 "$compare" "$work/first archive.tar" "$work/second.tar.gz"
cp "$work/first/file" "$work/second/file"
touch "$work/second/extra"
pack_second
expect_status 1 "$compare" "$work/first archive.tar" "$work/second.tar.gz"

# Invalid input must fail rather than compare two empty extraction directories.
expect_status 2 "$compare"
printf 'not an archive' > "$work/invalid.tar"
expect_status 2 "$compare" "$work/invalid.tar" "$work/second.tar.gz"

echo 'Archive comparison tests passed.'

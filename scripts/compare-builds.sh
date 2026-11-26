#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

if [[ $# -ne 2 ]]; then
    echo "Usage: $0 <archive1> <archive2>" >&2
    exit 2
fi

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
mkdir "$work/first" "$work/second"

# GNU tar and diff are included with Git Bash. --force-local accepts Windows
# drive letters; --binary prevents diff from hiding CRLF differences on Windows.
tar --force-local -xf "$1" -C "$work/first"
tar --force-local -xf "$2" -C "$work/second"
diff -qr --binary --no-dereference -- "$work/first" "$work/second"
echo 'Builds match.'

# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
export LC_ALL=C

output=${1:?missing output path}
qt=$(cd "$(dirname "$0")" && pwd)
pending=$(mktemp "${output}.XXXXXXXX")
trap 'rm -f -- "$pending"' EXIT
# Normalize metadata without changing the files. Only directories get execute bits.
# Write beside the destination so a failed pipeline cannot publish a partial archive.
# Read packaging inputs from the checkout and application files from the build directory.
tar --format=gnu --sort=name --owner=0 --group=0 --numeric-owner --hard-dereference \
    --mode='a=r,u+w,a+X' --mtime="@${SOURCE_DATE_EPOCH:?missing commit timestamp}" -cf - \
    -C "$qt/../.." APP_VERSION \
    -C "$qt/resources/win" icon.ico \
    -C "$qt" setup.nsi sign-windows-release.py \
    -C "$qt/build" windows | gzip -n -6 > "$pending"
mv -f -- "$pending" "$output"

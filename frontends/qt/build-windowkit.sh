#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

qt_root="$(qmake -query QT_INSTALL_PREFIX)"
source_root="$(cd "$(dirname "$0")" && pwd)"
build_root="${1:-$source_root/build}/qwindowkit"
platform_options=()
if [[ "$(uname -s)" == Darwin ]]; then
    platform_options+=("-DCMAKE_OSX_ARCHITECTURES=x86_64;arm64")
    if [[ -n "${MACOS_MIN_VERSION:-}" ]]; then
        platform_options+=("-DCMAKE_OSX_DEPLOYMENT_TARGET=$MACOS_MIN_VERSION")
    fi
fi
cmake -S "$source_root/external/qwindowkit" -B "$build_root/build" \
    "${platform_options[@]}" \
    -DCMAKE_PREFIX_PATH="$qt_root" \
    -DCMAKE_INSTALL_PREFIX="$build_root/install" \
    -DCMAKE_INSTALL_LIBDIR=lib -DCMAKE_BUILD_TYPE=Release \
    -DQWINDOWKIT_BUILD_STATIC=ON -DQWINDOWKIT_BUILD_QUICK=OFF \
    -DQWINDOWKIT_BUILD_TESTS=OFF -DQWINDOWKIT_BUILD_EXAMPLES=OFF \
    -DQWINDOWKIT_ENABLE_STYLE_AGENT=OFF
cmake --build "$build_root/build" --parallel "${CSD_BUILD_JOBS:-4}"
cmake --install "$build_root/build"
mkdir -p "$build_root/install/share/doc/QWindowKit"
cp "$source_root/external/qwindowkit/LICENSE" "$source_root/external/qwindowkit/BITBOX-DEPENDENCY.md" \
    "$build_root/install/share/doc/QWindowKit/"

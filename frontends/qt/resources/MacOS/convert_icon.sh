#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# Generates Assets.car and icon.icns from Apple Icon Composer file using Xcode 26 ACtool

set -euo pipefail

cd "$(dirname "$0")"

xcrun actool "$PWD/icon.icon" \
	--compile . \
	--app-icon icon \
	--enable-on-demand-resources NO \
	--minimum-deployment-target 10.15 \
	--platform macosx \
	--output-partial-info-plist icon-partial.plist

test -f Assets.car
test -f icon.icns

rm icon-partial.plist
cp icon.icns Testnet.app/Contents/Resources/icon.icns

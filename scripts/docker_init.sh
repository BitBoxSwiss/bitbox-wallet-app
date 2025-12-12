#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

export BITBOX_WALLET_HOST=$(netstat -nr | grep '^0\.0\.0\.0' | awk '{print $2}')

cd /opt/go/src/github.com/BitBoxSwiss/bitbox-wallet-app/
bash

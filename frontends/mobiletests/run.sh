#!/usr/bin/env sh
# SPDX-License-Identifier: Apache-2.0

set -e

# --- Run Appium in background ---
appium --allow-insecure=*:chromedriver_autodownload --port 4723 &
APPIUM_PID=$!
trap 'kill $APPIUM_PID || true' EXIT

timeout=20
elapsed=0
interval=2

until curl -s http://localhost:4723/status | grep '"ready":true'; do
  if [ $elapsed -ge $timeout ]; then
    echo "Appium did not become ready within $timeout seconds."
    exit 1
  fi
  echo "Waiting for Appium..."
  sleep $interval
  elapsed=$((elapsed + interval))
done

# --- Temporarily disable exit on error to capture test status ---
set +e
# --- Run tests ---
npm run test
TEST_STATUS=$?
set -e
echo "Tests finished with status: $TEST_STATUS"

exit $TEST_STATUS

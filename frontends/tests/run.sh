#!/usr/bin/env sh
set -e

# --- Run Appium in background ---
npx appium --allow-insecure=*:chromedriver_autodownload --port 4723 &

# Wait for Appium to be ready
until curl -s http://localhost:4723/status | grep '"ready":true'; do
  echo "Waiting for Appium..."
  sleep 2
done

# --- Run tests ---
npm run test
TEST_STATUS=$?
echo "Tests finished with status: $TEST_STATUS"

kill -9 $(pgrep -f appium)

exit $TEST_STATUS

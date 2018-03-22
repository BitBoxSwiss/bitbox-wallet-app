#!/bin/bash -e

trap 'killall' EXIT

killall() {
    trap '' INT TERM
    kill -TERM 0
    wait
}

./scripts/run_regtest.sh >/dev/null 2>/dev/null &

echo "Waiting for electrumx server"
until $(curl --output /dev/null --silent --head --fail "127.0.0.1:52001"); do
    printf "."
    sleep 1
done

echo
echo "Running functional tests"

# -count=1 to disable caching (see `go help test`).
cd backend
FUNCTIONAL_TEST=1 go test -count=1 -v .

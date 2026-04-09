#!/bin/bash -e
# SPDX-License-Identifier: Apache-2.0

BITCOIND_CONTAINER_NAME="bitcoind-regtest"
ELECTRS_CONTAINER_NAME1="electrs-regtest1"
ELECTRS_CONTAINER_NAME2="electrs-regtest2"
BITCOIND_VOLUME_NAME="bitcoind-regtest-data"
ELECTRS_VOLUME_NAME1="electrs-regtest-data1"
ELECTRS_VOLUME_NAME2="electrs-regtest-data2"

trap 'killall' EXIT

cleanup_leftovers() {
    docker rm -f "$BITCOIND_CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm -f "$ELECTRS_CONTAINER_NAME1" >/dev/null 2>&1 || true
    docker rm -f "$ELECTRS_CONTAINER_NAME2" >/dev/null 2>&1 || true
    docker volume rm -f "$BITCOIND_VOLUME_NAME" >/dev/null 2>&1 || true
    docker volume rm -f "$ELECTRS_VOLUME_NAME1" >/dev/null 2>&1 || true
    docker volume rm -f "$ELECTRS_VOLUME_NAME2" >/dev/null 2>&1 || true
}

killall() {
    # https://unix.stackexchange.com/questions/55558/how-can-i-kill-and-wait-for-background-processes-to-finish-in-a-shell-script-whe
    trap '' INT TERM # ignore INT and TERM while shutting down
    echo "**** Shutting down... ****"
    kill -TERM 0
    wait
    cleanup_leftovers
    echo DONE
}

cleanup_leftovers

docker volume create "$BITCOIND_VOLUME_NAME" >/dev/null
docker volume create "$ELECTRS_VOLUME_NAME1" >/dev/null
docker volume create "$ELECTRS_VOLUME_NAME2" >/dev/null

docker run --rm -v "${ELECTRS_VOLUME_NAME1}:/data" alpine:3.20 \
       sh -lc 'echo -n "dbb:dbb" > /data/rpccreds'
docker run --rm -v "${ELECTRS_VOLUME_NAME2}:/data" alpine:3.20 \
       sh -lc 'echo -n "dbb:dbb" > /data/rpccreds'

# Default docker bridge.
DOCKER_IP="172.17.0.1"
BITCOIND_PORT=12340
BITCOIND_RPC_PORT=10332
ELECTRS_RPC_PORT1=52001
ELECTRS_RPC_PORT2=52002
ELECTRS_MONITORING_PORT1=24224
ELECTRS_MONITORING_PORT2=24225

docker run -v "${BITCOIND_VOLUME_NAME}:/bitcoin/.bitcoin" --name="$BITCOIND_CONTAINER_NAME" \
       -p ${BITCOIND_RPC_PORT}:${BITCOIND_RPC_PORT} \
       -p ${BITCOIND_PORT}:${BITCOIND_PORT} \
       bitcoin/bitcoin:30.0 \
       -datadir=/bitcoin \
       -regtest \
       -fallbackfee=0.00001 \
       -port=${BITCOIND_PORT} \
       -rpcport=${BITCOIND_RPC_PORT} \
       -rpcuser=dbb \
       -rpcpassword=dbb \
       -rpcbind=0.0.0.0 \
       -printtoconsole=0 \
       -rpcallowip=$DOCKER_IP/16 &

sleep 1

docker run \
       -u $(id -u $USER) \
       -p ${ELECTRS_RPC_PORT1}:${ELECTRS_RPC_PORT1} \
       -p ${ELECTRS_MONITORING_PORT1}:${ELECTRS_MONITORING_PORT1} \
       -v "${BITCOIND_VOLUME_NAME}:/bitcoin/.bitcoin" \
       -v "${ELECTRS_VOLUME_NAME1}:/data" \
       --name="$ELECTRS_CONTAINER_NAME1" \
       benma2/electrs:v0.10.10 \
        --cookie-file=/data/rpccreds \
        --log-filters INFO \
        --network=regtest \
        --daemon-rpc-addr=${DOCKER_IP}:${BITCOIND_RPC_PORT} \
        --daemon-p2p-addr=${DOCKER_IP}:${BITCOIND_PORT} \
        --electrum-rpc-addr=0.0.0.0:${ELECTRS_RPC_PORT1} \
        --monitoring-addr=0.0.0.0:${ELECTRS_MONITORING_PORT1} \
        --daemon-dir=/bitcoin/.bitcoin \
        --db-dir=/data &

docker run \
       -u $(id -u $USER) \
       -p ${ELECTRS_RPC_PORT2}:${ELECTRS_RPC_PORT2} \
       -p ${ELECTRS_MONITORING_PORT2}:${ELECTRS_MONITORING_PORT2} \
       -v "${BITCOIND_VOLUME_NAME}:/bitcoin/.bitcoin" \
       -v "${ELECTRS_VOLUME_NAME2}:/data" \
       --name="$ELECTRS_CONTAINER_NAME2" \
       benma2/electrs:v0.10.10 \
        --cookie-file=/data/rpccreds \
        --log-filters INFO \
        --network=regtest \
        --daemon-rpc-addr=${DOCKER_IP}:${BITCOIND_RPC_PORT} \
        --daemon-p2p-addr=${DOCKER_IP}:${BITCOIND_PORT} \
        --electrum-rpc-addr=0.0.0.0:${ELECTRS_RPC_PORT2} \
        --monitoring-addr=0.0.0.0:${ELECTRS_MONITORING_PORT2} \
        --daemon-dir=/bitcoin/.bitcoin \
        --db-dir=/data &

echo "Interact with the regtest chain (e.g. generate 101 blocks and send coins):"
echo "    docker exec --user=`id -u` -it $BITCOIND_CONTAINER_NAME bitcoin-cli -regtest -datadir=/bitcoin -rpcuser=dbb -rpcpassword=dbb -rpcport=$BITCOIND_RPC_PORT createwallet testwallet"
echo "    docker exec --user=`id -u` -it $BITCOIND_CONTAINER_NAME bitcoin-cli -regtest -datadir=/bitcoin -rpcuser=dbb -rpcpassword=dbb -rpcport=$BITCOIND_RPC_PORT getnewaddress"
echo "    docker exec --user=`id -u` -it $BITCOIND_CONTAINER_NAME bitcoin-cli -regtest -datadir=/bitcoin -rpcuser=dbb -rpcpassword=dbb -rpcport=$BITCOIND_RPC_PORT generatetoaddress 101 <newaddress>"
echo "    docker exec --user=`id -u` -it $BITCOIND_CONTAINER_NAME bitcoin-cli -regtest -datadir=/bitcoin -rpcuser=dbb -rpcpassword=dbb -rpcport=$BITCOIND_RPC_PORT sendtoaddress <address> <amount>"
echo "Delete headers-rbtc.bin in the app cache folder before running the BitBoxApp, otherwise it can conflict the fresh regtest chain."
echo "Also delete all rbtc account caches in the app cache folder before running the BitBoxApp."
echo "You may need to disable VPN, as it can prevent Electrs/bitcoin-cli from connecting to bitcoind."

while true; do sleep 1; done

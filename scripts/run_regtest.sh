#!/bin/bash -e
# Copyright 2018 Shift Devices AG
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


BITCOIN_DATADIR="/tmp/regtest/btcdata"
ELECTRS_DATADIR1="/tmp/regtest/electrsdata1"
ELECTRS_DATADIR2="/tmp/regtest/electrsdata2"

trap 'killall' EXIT

killall() {
    # https://unix.stackexchange.com/questions/55558/how-can-i-kill-and-wait-for-background-processes-to-finish-in-a-shell-script-whe
    trap '' INT TERM # ignore INT and TERM while shutting down
    echo "**** Shutting down... ****"
    kill -TERM 0
    wait
    rm -rf $BITCOIN_DATADIR
    rm -rf $ELECTRS_DATADIR1
    rm -rf $ELECTRS_DATADIR2
    docker rm bitcoind-regtest
    docker rm electrs-regtest1
    docker rm electrs-regtest2
    echo DONE
}

mkdir -p $BITCOIN_DATADIR
mkdir -p $ELECTRS_DATADIR1
mkdir -p $ELECTRS_DATADIR2
echo -n "dbb:dbb" > $ELECTRS_DATADIR1/rpccreds
echo -n "dbb:dbb" > $ELECTRS_DATADIR2/rpccreds
echo "bitcoind datadir: ${BITCOIN_DATADIR}"
echo "electrs datadir1: ${ELECTRS_DATADIR1}"
echo "electrs datadir2: ${ELECTRS_DATADIR2}"

# Default docker bridge.
DOCKER_IP="172.17.0.1"
BITCOIND_PORT=12340
BITCOIND_RPC_PORT=10332
ELECTRS_RPC_PORT1=52001
ELECTRS_RPC_PORT2=52002

docker run -v $BITCOIN_DATADIR:/bitcoin/.bitcoin --name=bitcoind-regtest \
       -e DISABLEWALLET=0 \
       -e PRINTTOCONSOLE=0 \
       -e RPCUSER=dbb \
       -e RPCPASSWORD=dbb \
       -p ${BITCOIND_RPC_PORT}:${BITCOIND_RPC_PORT} \
       -p ${BITCOIND_PORT}:${BITCOIND_PORT} \
       kylemanna/bitcoind \
       -regtest \
       -fallbackfee=0.00001 \
       -port=${BITCOIND_PORT} \
       -rpcport=${BITCOIND_RPC_PORT} \
       -rpcbind=0.0.0.0 \
       -rpcallowip=$DOCKER_IP/16 &

docker run \
       -u $(id -u $USER) \
       --net=host \
       -v $BITCOIN_DATADIR/.bitcoin:/bitcoin/.bitcoin \
       -v $ELECTRS_DATADIR1:/data \
       --name=electrs-regtest1 \
       benma2/electrs:v0.9.9 \
        --cookie-file=/data/rpccreds \
        --log-filters INFO \
        --timestamp \
        --network=regtest \
        --daemon-rpc-addr=${DOCKER_IP}:${BITCOIND_RPC_PORT} \
        --daemon-p2p-addr=${DOCKER_IP}:${BITCOIND_PORT} \
        --electrum-rpc-addr=127.0.0.1:${ELECTRS_RPC_PORT1} \
        --daemon-dir=/bitcoin/.bitcoin \
        --db-dir=/data &

docker run \
       -u $(id -u $USER) \
       --net=host \
       -v $BITCOIN_DATADIR/.bitcoin:/bitcoin/.bitcoin \
       -v $ELECTRS_DATADIR2:/data \
       --name=electrs-regtest2 \
       benma2/electrs:v0.9.9 \
        --cookie-file=/data/rpccreds \
        --log-filters INFO \
        --timestamp \
        --network=regtest \
        --daemon-rpc-addr=${DOCKER_IP}:${BITCOIND_RPC_PORT} \
        --daemon-p2p-addr=${DOCKER_IP}:${BITCOIND_PORT} \
        --electrum-rpc-addr=127.0.0.1:${ELECTRS_RPC_PORT2} \
        --daemon-dir=/bitcoin/.bitcoin \
        --db-dir=/data &

echo "Interact with the regtest chain (e.g. generate 101 blocks and send coins):"
echo "    docker exec --user=`id -u` -it bitcoind-regtest bitcoin-cli -regtest -datadir=/bitcoin -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 createwallet"
echo "    docker exec --user=`id -u` -it bitcoind-regtest bitcoin-cli -regtest -datadir=/bitcoin -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 getnewaddress"
echo "    docker exec --user=`id -u` -it bitcoind-regtest bitcoin-cli -regtest -datadir=/bitcoin -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 generatetoaddress 101 <newaddress>"
echo "    docker exec --user=`id -u` -it bitcoind-regtest bitcoin-cli -regtest -datadir=/bitcoin -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 sendtoaddress <address> <amount>"
echo "Delete headers-rbtc.bin in the app cache folder before running the BitBoxApp, otherwise it can conflict the fresh regtest chain."
echo "You may need to disable VPN, as it can prevent Electrs/bitcoin-cli from connecting to bitcoind."

while true; do sleep 1; done

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
ELECTRS_DATADIR="/tmp/regtest/electrsdata"

trap 'killall' EXIT

killall() {
    # https://unix.stackexchange.com/questions/55558/how-can-i-kill-and-wait-for-background-processes-to-finish-in-a-shell-script-whe
    trap '' INT TERM # ignore INT and TERM while shutting down
    echo "**** Shutting down... ****"
    kill -TERM 0
    wait
    rm -rf $BITCOIN_DATADIR
    rm -rf $ELECTRS_DATADIR
    docker rm bitcoind-regtest
    docker rm electrs-regtest
    echo DONE
}

mkdir -p $BITCOIN_DATADIR
mkdir -p $ELECTRS_DATADIR
echo -n "dbb:dbb" > $ELECTRS_DATADIR/rpccreds
echo "bitcoind datadir: ${BITCOIN_DATADIR}"
echo "electrs datadir: ${ELECTRS_DATADIR}"

# Default docker bridge.
DOCKER_IP="172.17.0.1"

docker run -v $BITCOIN_DATADIR:/bitcoin --name=bitcoind-regtest \
       -e DISABLEWALLET=0 \
       -e PRINTTOCONSOLE=0 \
       -e RPCUSER=dbb \
       -e RPCPASSWORD=dbb \
       -p 10332:10332 \
       -p 12340:12340 \
       kylemanna/bitcoind \
       -regtest \
       -fallbackfee=0.00001 \
       -port=12340 \
       -rpcport=10332 \
       -rpcbind=0.0.0.0 \
       -rpcallowip=$DOCKER_IP/16 &

docker run \
       -u $(id -u $USER) \
       --net=host \
       -v $BITCOIN_DATADIR/.bitcoin:/bitcoin \
       -v $ELECTRS_DATADIR:/data \
       --name=electrs-regtest \
       benma2/electrs:v0.9.9 \
        --cookie-file=/data/rpccreds --log-filters INFO --timestamp --network=regtest --daemon-rpc-addr=${DOCKER_IP}:10332 --daemon-p2p-addr=${DOCKER_IP}:12340 --electrum-rpc-addr=127.0.0.1:52001 --daemon-dir=/bitcoin --db-dir=/data &

echo "Interact with the regtest chain (e.g. generate 101 blocks and send coins):"
echo "    bitcoin-cli -regtest -datadir=${BITCOIN_DATADIR} -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 createwallet"
echo "    bitcoin-cli -regtest -datadir=${BITCOIN_DATADIR} -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 getnewaddress"
echo "    bitcoin-cli -regtest -datadir=${BITCOIN_DATADIR} -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 generatetoaddress 101 <newaddress>"
echo "    bitcoin-cli -regtest -datadir=${BITCOIN_DATADIR} -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 sendtoaddress <address> <amount>"
echo "Delete headers-rbtc.bin in the app cache folder before running the BitBoxApp, otherwise it can conflict the fresh regtest chain."

while true; do sleep 1; done

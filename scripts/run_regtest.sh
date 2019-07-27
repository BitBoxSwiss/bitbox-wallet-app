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
ELECTRUMX_DATADIR="/tmp/regtest/electrumxdata"

trap 'killall' EXIT

killall() {
    # https://unix.stackexchange.com/questions/55558/how-can-i-kill-and-wait-for-background-processes-to-finish-in-a-shell-script-whe
    trap '' INT TERM # ignore INT and TERM while shutting down
    echo "**** Shutting down... ****"
    kill -TERM 0
    wait
    rm -rf $BITCOIN_DATADIR
    rm -rf $ELECTRUMX_DATADIR
    docker rm bitcoind-regtest
    docker rm electrumx-regtest
    echo DONE
}

mkdir -p $BITCOIN_DATADIR
mkdir -p $ELECTRUMX_DATADIR
echo "bitcoind datadir: ${BITCOIN_DATADIR}"
echo "electrumx datadir: ${ELECTRUMX_DATADIR}"

# Default docker bridge.
DOCKER_IP="172.17.0.1"

docker run -v $BITCOIN_DATADIR:/bitcoin --name=bitcoind-regtest \
       -e DISABLEWALLET=0 \
       -e PRINTTOCONSOLE=0 \
       -e RPCUSER=dbb \
       -e RPCPASSWORD=dbb \
       -p 10332:10332 \
       kylemanna/bitcoind \
       -regtest \
       -port=12340 \
       -rpcport=10332 \
       -txindex=1 \
       -rpcbind=0.0.0.0 \
       -rpcallowip=$DOCKER_IP/16 &

docker run \
       -u $(id -u $USER) \
       -v $ELECTRUMX_DATADIR:/data \
       -e DAEMON_URL="dbb:dbb@${DOCKER_IP}:10332" \
       -e COIN=BitcoinSegwit \
       -e NET=regtest \
       -e PEER_DISCOVERY= \
       -p 52001:52001 \
       -e REQUEST_SLEEP=0 \
       -p 10002:10002 \
       -e SERVICES=rpc://0.0.0.0:10002,tcp://0.0.0.0:52001,ssl://0.0.0.0:52002 \
       --name=electrumx-regtest \
       lukechilds/electrumx &

echo "Interact with the regtest chain (e.g. generate 101 blocks and send coins):"
echo "    bitcoin-cli -regtest -datadir=${BITCOIN_DATADIR} -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 getnewaddress"
echo "    bitcoin-cli -regtest -datadir=${BITCOIN_DATADIR} -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 generatetoaddress 101 <newaddress>"
echo "    bitcoin-cli -regtest -datadir=${BITCOIN_DATADIR} -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 sendtoaddress <address> <amount>"

while true; do sleep 1; done

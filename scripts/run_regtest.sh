#!/bin/bash -e

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
       -rpcallowip=$DOCKER_IP/16 &

docker run \
       -u $(id -u $USER) \
       -v $ELECTRUMX_DATADIR:/data \
       -e DAEMON_URL="dbb:dbb@${DOCKER_IP}:10332" \
       -e COIN=BitcoinSegwit \
       -e NET=regtest \
       -e RPC_PORT=10002 \
       -e PEER_DISCOVERY= \
       -e HOST=0.0.0.0 \
       -e RPC_HOST=0.0.0.0 \
       -e TCP_PORT=52001 \
       -e SSL_PORT=52002 \
       -p 52001:52001 \
       -p 10002:10002 \
       --name=electrumx-regtest \
       lukechilds/electrumx &

echo "Interact with the regtest chain (e.g. generate 101 blocks and send coins):"
echo "    bitcoin-cli -regtest -datadir=${BITCOIN_DATADIR} -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 generate 101"
echo "    bitcoin-cli -regtest -datadir=${BITCOIN_DATADIR} -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 sendtoaddress <address> <amount>"

while true; do sleep 1; done

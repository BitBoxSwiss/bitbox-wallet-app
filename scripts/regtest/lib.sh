#!/bin/bash

btc_cli() {
    if [ "$DOCKER_REGTEST" = 1 ]; then
        output=$(docker exec --user=$(id -u) -it bitcoind-regtest bitcoin-cli -regtest -datadir=/bitcoin -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 "$@")
        echo $output | tr -d '\r'
else
    bitcoin-cli -regtest "$@"
    fi
}

main() {
    btc_cli -rpcwallet="main" "$@"
}

alice() {
    btc_cli -rpcwallet="alice" "$@"
}

bob() {
    btc_cli -rpcwallet="bob" "$@"
}

bitbox() {
    btc_cli -rpcwallet="bitbox" "$@"
}

############################

mine_blocks () {
    wallet=${2:-main} 
    btc_cli -rpcwallet=main generatetoaddress $1 $($wallet getnewaddress) 
    main generatetoaddress $1 $($wallet getnewaddress) 
}

# Send $2 BTC to wallet $1 from main wallet.
fund_wallet () {
    wallet=${2:-main}
    recv_address=$($wallet getnewaddress)
    main sendtoaddress $recv_address $1
    mine_blocks 6
}

############################

# DOCKER_REGTEST=1 will use the bitcoind-regtest environmnent.
if [ "${DOCKER_REGTEST}" = 1 ]; then
    echo "Using bitcoind-regtest container. Make sure to run run_regtest.sh too"
else
    echo "Using local bitcoind -regtest. In case you want to run run_regtest.sh set the DOCKER_REGTEST=1"
fi

# Create or load wallets.
wallets=($(btc_cli listwalletdir | jq -r '.wallets[].name'))
loaded_wallets=($(btc_cli listwallets | jq -r '.[]'))
for wallet in main alice bob bitbox; do
    if [[ "${wallets[@]}" =~ ${wallet} ]]; then
        if [[ ! "${loaded_wallets[@]}" =~ ${wallet} ]]; then
          echo "load wallet: $wallet"
          btc_cli loadwallet $wallet
        fi 
    else
        echo "create wallet: $wallet"
        if [[ "$wallet" == "bitbox" ]]; then
            # Create a blank=true wallet to avoid accidentially using the wrong keys.
            # Import the first account using descriptors.
            btc_cli createwallet $wallet false true
            bitbox importdescriptors "$(cat account0.json)"
        else
            btc_cli createwallet $wallet
        fi 
    fi
done

echo "=== Functions ==="
echo "Any function that takes <wallet> as an argument can omit it to fallback on the main wallet."

echo ""
echo "1. mine_blocks <n> <wallet>"
echo "   Description: Mines n-blocks to <wallet>."
echo "   Example: mine_blocks 50 bitbox"

echo ""
echo "2. fund_wallet <n> <wallet>"
echo "   Description: Sends n-BTC (from main) to <wallet> and mines 6 blocks for full confirmation."
echo "   Example: fund_wallet 10 bitbox"

echo ""
echo "=== Aliases ==="
echo "Use 'btc_cli' as an alias for 'bitcoin-cli'."
echo "Example: btc_cli --rpcwallet=<wallet> getnewaddress"

echo ""
echo "Use <wallet> directly as an alias for 'btc_cli --rpcwallet=<wallet>'."
echo "Example: alice getnewaddress"

echo ""
echo "=== Available Wallets ==="
echo "main, alice, bob, bitbox"
echo "IN CASE YOU USE LOCAL bitcoind -regtest YOU MIGHT WANT TO rm -rf ~/.bitcoin/regtest FOR A CLEAN SETUP AFTER RUNNING THIS"

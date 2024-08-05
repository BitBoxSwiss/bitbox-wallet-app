#!/bin/bash

source lib.sh


# Example 1. BB02 send 1BTC to alice and bob in one tx.
example_sendmany_alice_bob() {
    addressAlice=$(alice getnewaddress)
    addressBob=$(bob getnewaddress)
    sendmany_json="{\"$addressAlice\":1,\"$addressBob\":1}"
    bitbox sendmany "" $sendmany_json
}
# Example 2. BB02 send 1BTC to alice, bob, and self in one tx.
example_sendmany_alice_bob_self() {
    addressAlice=$(alice getnewaddress)
    addressBob=$(bob getnewaddress)
    addressSelf=$(bitbox getnewaddress)
    sendmany_json="{\"$addressAlice\":1,\"$addressBob\":1,\"$addressSelf\":1}"
    bitbox sendmany "" $sendmany_json
}
# Example 3. BB02 receive two outputs in one tx.
example_bitbox_receive_many() {
    address1=$(bitbox getnewaddress)
    address2=$(bitbox getnewaddress)
    sendmany_json="{\"$address1\":1,\"$address2\":2}"
    main sendmany "" $sendmany_json
}
# Example 4. BB02 coinjoin wallet balance decrease.
example_coinjoin_balance_decrease() {
    echo "todo"
}
# Example 5. BB02 coinjoin wallet balance increase.
# Example 6. BB02 send payjoin.
# Example 7. BB02 receive payjoin.
# Example 8. BB02 receive payjoin.
# TODO: RBF after pending for mutliple blocks.
# TODO: CPFP after pending for multiple blocks.
# TODO: Canceled trasnaction after pending for multiple blocks.
# TODO: Canceled PARENT with in-fight CPFP from BB02 after pending for mutliple blocks.
# TODO: Re-Orgs
# TODO: Etc. 

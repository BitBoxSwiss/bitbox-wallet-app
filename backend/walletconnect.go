// SPDX-License-Identifier: Apache-2.0

package backend

import (
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/ethereum/go-ethereum/core/types"
)

// SignWalletConnectTransaction selects the target-chain dependencies for EVM signing.
func (backend *Backend) SignWalletConnectTransaction(
	accountCode accountsTypes.Code,
	args eth.SignTransactionArgs,
) (*types.Transaction, error) {
	acct, err := backend.GetAccountFromCode(accountCode)
	if err != nil {
		return nil, err
	}
	account, ok := acct.(*eth.Account)
	if !ok {
		return nil, errp.New("Must be an ETH based account")
	}
	var client rpcclient.Interface
	var pending *eth.PendingTransactions
	if args.ChainID == account.ETHCoin().ChainID() {
		client = account.ETHCoin().Client()
		pending = account.PendingTransactions()
	} else if backend.ethChainClientProvider != nil {
		client = backend.ethChainClientProvider(args.ChainID)
	}
	return eth.SignTransaction(args, client, account.Info().SigningConfigurations[0],
		account.Config().ConnectKeystore, pending, backend.log)
}

// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"context"
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	keystoremock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/btcsuite/btcd/btcutil/v2/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg/v2"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
)

func TestSignWalletConnectTransactionChainDependencies(t *testing.T) {
	for _, tc := range []struct {
		name      string
		chainID   uint64
		broadcast bool
	}{
		{"native broadcast", 11155111, true},
		{"native sign only", 11155111, false},
		{"other chain broadcast", 10, true},
		{"other chain sign only", 10, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			log := logging.Get().WithGroup("walletconnect_test")
			key, err := hdkeychain.NewMaster(make([]byte, 32), &chaincfg.TestNet3Params)
			require.NoError(t, err)
			xpub, err := key.Neuter()
			require.NoError(t, err)
			privateKey, err := key.ECPrivKey()
			require.NoError(t, err)
			cfg := signing.NewEthereumConfiguration([]byte{1, 2, 3, 4}, mustKeypath("m/44'/60'/0'/0/0"), xpub)
			newClient := func() *mocks.InterfaceMock {
				return &mocks.InterfaceMock{
					BlockNumberFunc:                       func(context.Context) (*big.Int, error) { return big.NewInt(100), nil },
					NonceAtFunc:                           func(context.Context, common.Address, *big.Int) (uint64, error) { return 0, nil },
					TransactionReceiptWithBlockNumberFunc: func(context.Context, common.Hash) (*types.Receipt, error) { return nil, nil },
					BalanceFunc:                           func(context.Context, common.Address) (*big.Int, error) { return big.NewInt(1000000), nil },
					PendingNonceAtFunc:                    func(context.Context, common.Address) (uint64, error) { return 4, nil },
					EstimateGasFunc:                       func(context.Context, ethereum.CallMsg) (uint64, error) { return 21000, nil },
					SuggestGasPriceFunc:                   func(context.Context) (*big.Int, error) { return big.NewInt(3), nil },
					FeeTargetsFunc: func(context.Context) ([]*ethtypes.FeeTarget, error) {
						return []*ethtypes.FeeTarget{{TargetCode: accounts.FeeTargetCodeNormal, GasFeeCap: big.NewInt(3)}}, nil
					},
					SendTransactionFunc: func(context.Context, *types.Transaction) error { return nil },
				}
			}
			nativeCoin := eth.NewCoin(newClient(), coinpkg.CodeSEPETH, "Sepolia", "SEPETH", "SEPETH", params.SepoliaChainConfig, "", nil, nil)
			outgoing, err := eth.NewOutgoingTransactions(t.TempDir())
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, outgoing.Close()) })
			updates := make(chan struct{}, 2)
			account := eth.NewAccount(&accounts.AccountConfig{
				Code:                  "account",
				SigningConfigurations: signing.Configurations{cfg},
				DBFolder:              t.TempDir(), SkipInitialSync: true,
				GetNotifier: func(signing.Configurations) accounts.Notifier { return nil },
				ConnectKeystore: func() (keystore.Keystore, error) {
					return &keystoremock.KeystoreMock{SignTransactionFunc: func(value interface{}) error {
						proposal := value.(*eth.TxProposal)
						require.Equal(t, cfg.AbsoluteKeypath(), proposal.Keypath)
						signedTx, err := types.SignTx(proposal.Tx, proposal.Signer(), privateKey.ToECDSA())
						proposal.Tx = signedTx
						return err
					}}, nil
				},
			}, nativeCoin, outgoing, log, updates)
			require.NoError(t, account.Initialize())
			defer account.Close()
			b := newBackend(t, true, false)
			require.NoError(t, b.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
				accountsConfig.Accounts = append(accountsConfig.Accounts, &config.Account{
					Code:                  "account",
					CoinCode:              coinpkg.CodeSEPETH,
					SigningConfigurations: signing.Configurations{cfg},
				})
				return nil
			}))
			unlock := b.accountsAndKeystoreLock.Lock()
			b.addAccount(account)
			unlock()
			address, err := account.Address()
			require.NoError(t, err)
			nonce := uint64(9)
			args := eth.SignTransactionArgs{
				ChainID: nativeCoin.ChainID(), Broadcast: true,
				Transaction: eth.TransactionRequest{From: address.Address, Recipient: common.HexToAddress("0x1111111111111111111111111111111111111111"), Nonce: &nonce},
			}
			// Seed a native pending nonce higher than the node's response.
			_, err = b.SignWalletConnectTransaction("account", args)
			require.NoError(t, err)
			require.Len(t, updates, 1)
			<-updates
			nativeClient, targetClient := newClient(), newClient()
			nativeCoin.TstSetClient(nativeClient)
			providerCalls := 0
			b.ethChainClientProvider = func(chainID uint64) rpcclient.Interface {
				providerCalls++
				require.Equal(t, tc.chainID, chainID)
				return targetClient
			}
			args.ChainID, args.Broadcast, args.Transaction.Nonce = tc.chainID, tc.broadcast, nil
			tx, err := b.SignWalletConnectTransaction("account", args)
			require.NoError(t, err)
			require.Nil(t, args.Transaction.Nonce)
			require.Equal(t, new(big.Int).SetUint64(tc.chainID), tx.ChainId())
			selectedClient := nativeClient
			if tc.chainID == nativeCoin.ChainID() {
				require.Equal(t, uint64(10), tx.Nonce())
				require.Zero(t, providerCalls)
			} else {
				require.Equal(t, uint64(4), tx.Nonce())
				require.Equal(t, 1, providerCalls)
				require.Empty(t, nativeClient.EstimateGasCalls())
				require.Empty(t, nativeClient.PendingNonceAtCalls())
				require.Empty(t, nativeClient.SendTransactionCalls())
				selectedClient = targetClient
			}
			require.Len(t, selectedClient.PendingNonceAtCalls(), 1)
			require.Equal(t, address.Address, selectedClient.PendingNonceAtCalls()[0].Account)
			require.Len(t, selectedClient.EstimateGasCalls(), 1)
			if tc.broadcast {
				require.Len(t, selectedClient.SendTransactionCalls(), 1)
			} else {
				require.Empty(t, selectedClient.SendTransactionCalls())
			}
			// Only a successful native broadcast should affect the next native nonce or enqueue an update.
			args.ChainID, args.Broadcast = nativeCoin.ChainID(), false
			probe, err := b.SignWalletConnectTransaction("account", args)
			require.NoError(t, err)
			if tc.chainID == nativeCoin.ChainID() && tc.broadcast {
				require.Equal(t, uint64(11), probe.Nonce())
				require.Len(t, updates, 1)
			} else {
				require.Equal(t, uint64(10), probe.Nonce())
				require.Empty(t, updates)
			}
		})
	}
}

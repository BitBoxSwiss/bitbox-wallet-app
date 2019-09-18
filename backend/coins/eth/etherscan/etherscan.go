// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package etherscan

import (
	"context"
	"encoding/json"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/rpcclient"
	ethtypes "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/rlp"
)

// etherscan rate limits to one request per 0.2 seconds.
var callInterval = 210 * time.Millisecond

// EtherScan is a rate-limited etherscan api client. See https://etherscan.io/apis.
type EtherScan struct {
	url         string
	rateLimiter <-chan time.Time
	lock        locker.Locker
}

// NewEtherScan creates a new instance of EtherScan.
func NewEtherScan(url string) *EtherScan {
	return &EtherScan{
		url:         url,
		rateLimiter: time.After(0), // 0 so the first call does not wait.
	}
}

func (etherScan *EtherScan) call(params url.Values, result interface{}) error {
	defer etherScan.lock.Lock()()
	<-etherScan.rateLimiter
	defer func() {
		etherScan.rateLimiter = time.After(callInterval)
	}()

	response, err := http.Get(etherScan.url + "?" + params.Encode())
	if err != nil {
		return errp.WithStack(err)
	}
	defer func() { _ = response.Body.Close() }()
	if err := json.NewDecoder(response.Body).Decode(result); err != nil {
		return errp.WithStack(err)
	}
	return nil
}

type jsonBigInt big.Int

func (jsBigInt jsonBigInt) BigInt() *big.Int {
	bigInt := big.Int(jsBigInt)
	return &bigInt
}

// UnmarshalJSON implements json.Unmarshaler.
func (jsBigInt *jsonBigInt) UnmarshalJSON(jsonBytes []byte) error {
	var numberString string
	if err := json.Unmarshal(jsonBytes, &numberString); err != nil {
		return errp.WithStack(err)
	}
	bigInt, ok := new(big.Int).SetString(numberString, 10)
	if !ok {
		return errp.Newf("failed to parse %s", numberString)
	}
	*jsBigInt = jsonBigInt(*bigInt)
	return nil
}

type timestamp time.Time

// UnmarshalJSON implements json.Unmarshaler.
func (t *timestamp) UnmarshalJSON(jsonBytes []byte) error {
	var timestampString string
	if err := json.Unmarshal(jsonBytes, &timestampString); err != nil {
		return errp.WithStack(err)
	}
	timestampInt, err := strconv.ParseInt(timestampString, 10, 64)
	if err != nil {
		return errp.WithStack(err)
	}
	*t = timestamp(time.Unix(timestampInt, 0))
	return nil
}

type jsonTransaction struct {
	GasUsed       jsonBigInt     `json:"gasUsed"`
	GasPrice      jsonBigInt     `json:"gasPrice"`
	Hash          common.Hash    `json:"hash"`
	Timestamp     timestamp      `json:"timeStamp"`
	Confirmations jsonBigInt     `json:"confirmations"`
	From          common.Address `json:"from"`
	Failed        string         `json:"isError"`

	// One of them is an empty string / nil, the other is an address.
	ToAsString              string `json:"to"`
	to                      *common.Address
	ContractAddressAsString string `json:"contractAddress"`
	contractAddress         *common.Address

	Value jsonBigInt `json:"value"`
}

// Transaction implemements accounts.Transaction (TODO).
type Transaction struct {
	jsonTransaction jsonTransaction
	txType          accounts.TxType
}

// assertion because not implementing the interface fails silently.
var _ ethtypes.EthereumTransaction = &Transaction{}

// UnmarshalJSON implements json.Unmarshaler.
func (tx *Transaction) UnmarshalJSON(jsonBytes []byte) error {
	if err := json.Unmarshal(jsonBytes, &tx.jsonTransaction); err != nil {
		return errp.WithStack(err)
	}
	switch {
	case tx.jsonTransaction.ToAsString != "":
		if !common.IsHexAddress(tx.jsonTransaction.ToAsString) {
			return errp.Newf("eth address expected, got %s", tx.jsonTransaction.ToAsString)
		}
		addr := common.HexToAddress(tx.jsonTransaction.ToAsString)
		tx.jsonTransaction.to = &addr
	case tx.jsonTransaction.ContractAddressAsString != "":
		if !common.IsHexAddress(tx.jsonTransaction.ContractAddressAsString) {
			return errp.Newf("eth address expected, got %s", tx.jsonTransaction.ContractAddressAsString)
		}
		addr := common.HexToAddress(tx.jsonTransaction.ContractAddressAsString)
		tx.jsonTransaction.contractAddress = &addr
	default:
		return errp.New("Need one of: to, contractAddress")
	}
	return nil
}

// Fee implements accounts.Transaction.
func (tx *Transaction) Fee() *coin.Amount {
	fee := new(big.Int).Mul(tx.jsonTransaction.GasUsed.BigInt(), tx.jsonTransaction.GasPrice.BigInt())
	amount := coin.NewAmount(fee)
	return &amount
}

// Timestamp implements accounts.Transaction.
func (tx *Transaction) Timestamp() *time.Time {
	t := time.Time(tx.jsonTransaction.Timestamp)
	return &t
}

// ID implements accounts.Transaction.
func (tx *Transaction) ID() string {
	return tx.jsonTransaction.Hash.Hex()
}

// NumConfirmations implements accounts.Transaction.
func (tx *Transaction) NumConfirmations() int {
	return int(tx.jsonTransaction.Confirmations.BigInt().Int64())
}

// Type implements accounts.Transaction.
func (tx *Transaction) Type() accounts.TxType {
	return tx.txType
}

// Status implements accounts.Transaction.
func (tx *Transaction) Status() accounts.TxStatus {
	if tx.jsonTransaction.Failed == "1" {
		return accounts.TxStatusFailed
	}
	if tx.NumConfirmations() >= ethtypes.NumConfirmationsComplete {
		return accounts.TxStatusComplete
	}
	return accounts.TxStatusPending
}

// Amount implements accounts.Transaction.
func (tx *Transaction) Amount() coin.Amount {
	return coin.NewAmount(tx.jsonTransaction.Value.BigInt())
}

// Addresses implements accounts.Transaction.
func (tx *Transaction) Addresses() []accounts.AddressAndAmount {
	address := ""
	if tx.jsonTransaction.to != nil {
		address = tx.jsonTransaction.to.Hex()
	} else if tx.jsonTransaction.contractAddress != nil {
		address = tx.jsonTransaction.contractAddress.Hex()
	}
	return []accounts.AddressAndAmount{{
		Address: address,
		Amount:  tx.Amount(),
	}}
}

// Gas implements ethtypes.EthereumTransaction.
func (tx *Transaction) Gas() uint64 {
	if !tx.jsonTransaction.GasUsed.BigInt().IsInt64() {
		panic("gas must be int64")
	}
	return uint64(tx.jsonTransaction.GasUsed.BigInt().Int64())
}

// prepareTransactions casts to []accounts.Transactions and removes duplicate entries. Duplicate entries
// appear in the etherscan result if the recipient and sender are the same. It also sets the
// transaction type (send, receive, send to self) based on the account address.
func prepareTransactions(
	transactions []*Transaction, address common.Address) ([]accounts.Transaction, error) {
	seen := map[string]struct{}{}
	castTransactions := []accounts.Transaction{}
	ours := address.Hex()
	for _, transaction := range transactions {
		if _, ok := seen[transaction.ID()]; ok {
			continue
		}
		seen[transaction.ID()] = struct{}{}

		from := transaction.jsonTransaction.From.Hex()
		var to string
		switch {
		case transaction.jsonTransaction.to != nil:
			to = transaction.jsonTransaction.to.Hex()
		case transaction.jsonTransaction.contractAddress != nil:
			to = transaction.jsonTransaction.contractAddress.Hex()
		default:
			return nil, errp.New("must have either to address or contract address")
		}
		if ours != from && ours != to {
			return nil, errp.New("transaction does not belong to our account")
		}
		switch {
		case ours == from && ours == to:
			transaction.txType = accounts.TxTypeSendSelf
		case ours == from:
			transaction.txType = accounts.TxTypeSend
		default:
			transaction.txType = accounts.TxTypeReceive
		}
		castTransactions = append(castTransactions, transaction)
	}
	return castTransactions, nil
}

// Transactions queries EtherScan for transactions for the given account, until endBlock.
// Provide erc20Token to filter for those. If nil, standard etheruem transactions will be fetched.
func (etherScan *EtherScan) Transactions(
	address common.Address, endBlock *big.Int, erc20Token *erc20.Token) (
	[]accounts.Transaction, error) {
	params := url.Values{}
	params.Set("module", "account")
	if erc20Token != nil {
		params.Set("action", "tokentx")
		params.Set("contractAddress", erc20Token.ContractAddress().Hex())
	} else {
		params.Set("action", "txlist")
	}
	params.Set("startblock", "0")
	params.Set("tag", "latest")
	params.Set("sort", "desc") // desc by block number

	params.Set("endblock", endBlock.Text(10))
	params.Set("address", address.Hex())

	result := struct {
		Result []*Transaction
	}{}
	if err := etherScan.call(params, &result); err != nil {
		return nil, err
	}

	return prepareTransactions(result.Result, address)
}

// ----- RPC node proxy methods follow

func (etherScan *EtherScan) rpcCall(params url.Values, result interface{}) error {
	params.Set("module", "proxy")

	var wrapped struct {
		JSONRPC string           `json:"jsonrpc"`
		ID      int              `json:"id"`
		Error   *json.RawMessage `json:"error"`
		Result  *json.RawMessage `json:"result"`
	}
	if err := etherScan.call(params, &wrapped); err != nil {
		return nil
	}
	if wrapped.Error != nil {
		return errp.WithMessage(errp.New("unexpected error"), string(*wrapped.Error))
	}
	if result == nil {
		return nil
	}
	if wrapped.Result == nil {
		return errp.New("expected result")
	}
	return json.Unmarshal(*wrapped.Result, result)
}

// TransactionReceiptWithBlockNumber implements rpc.Interface
func (etherScan *EtherScan) TransactionReceiptWithBlockNumber(
	ctx context.Context, hash common.Hash) (*rpcclient.RPCTransactionReceipt, error) {
	params := url.Values{}
	params.Set("action", "eth_getTransactionReceipt")
	params.Set("txhash", hash.Hex())
	var result *rpcclient.RPCTransactionReceipt
	if err := etherScan.rpcCall(params, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// HeaderByNumber implements rpc.Interface
func (etherScan *EtherScan) HeaderByNumber(ctx context.Context, number *big.Int) (*types.Header, error) {
	params := url.Values{}
	params.Set("action", "eth_getBlockByNumber")
	if number == nil {
		params.Set("tag", "latest")
	} else {
		panic("not implemented")
	}
	params.Set("boolean", "false")
	var result *types.Header
	if err := etherScan.rpcCall(params, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// BalanceAt implements rpc.Interface
func (etherScan *EtherScan) BalanceAt(ctx context.Context, account common.Address, blockNumber *big.Int) (*big.Int, error) {
	var result struct {
		Status  string
		Message string
		Result  string
	}

	params := url.Values{}
	params.Set("module", "account")
	params.Set("action", "balance")
	params.Set("address", account.Hex())
	if blockNumber == nil {
		params.Set("tag", "latest")
	} else {
		panic("not implemented")
	}
	if err := etherScan.call(params, &result); err != nil {
		return nil, err
	}
	if result.Status != "1" {
		return nil, errp.New("unexpected response")
	}
	balance, ok := new(big.Int).SetString(result.Result, 10)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return balance, nil
}

// CallContract implements rpc.Interface
func (etherScan *EtherScan) CallContract(ctx context.Context, msg ethereum.CallMsg, blockNumber *big.Int) ([]byte, error) {
	params := url.Values{}
	params.Set("action", "eth_call")
	callMsgParams(&params, msg)
	if blockNumber == nil {
		params.Set("tag", "latest")
	} else {
		panic("not implemented")
	}
	var result hexutil.Bytes
	if err := etherScan.rpcCall(params, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// CodeAt implements rpc.Interface
func (etherScan *EtherScan) CodeAt(ctx context.Context, account common.Address, blockNumber *big.Int) ([]byte, error) {
	panic("not implemented")
}

func callMsgParams(params *url.Values, msg ethereum.CallMsg) {
	params.Set("from", msg.From.Hex())
	params.Set("to", msg.To.Hex())
	if msg.Data != nil {
		params.Set("data", hexutil.Bytes(msg.Data).String())
	}
	if msg.Value != nil {
		params.Set("value", (*hexutil.Big)(msg.Value).String())
	}
	if msg.Gas != 0 {
		panic("not implemented")
	}
	if msg.GasPrice != nil {
		params.Set("gasPrice", (*hexutil.Big)(msg.GasPrice).String())
	}
}

// EstimateGas implements rpc.Interface
func (etherScan *EtherScan) EstimateGas(ctx context.Context, msg ethereum.CallMsg) (uint64, error) {
	params := url.Values{}
	params.Set("action", "eth_estimateGas")
	callMsgParams(&params, msg)

	var result hexutil.Uint64
	if err := etherScan.rpcCall(params, &result); err != nil {
		return 0, err
	}
	return uint64(result), nil
}

// FilterLogs implements rpc.Interface
func (etherScan *EtherScan) FilterLogs(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error) {
	panic("not implemented")
}

// PendingCodeAt implements rpc.Interface
func (etherScan *EtherScan) PendingCodeAt(ctx context.Context, account common.Address) ([]byte, error) {
	panic("not implemented")
}

// PendingNonceAt implements rpc.Interface
func (etherScan *EtherScan) PendingNonceAt(ctx context.Context, account common.Address) (uint64, error) {
	params := url.Values{}
	params.Set("action", "eth_getTransactionCount")
	params.Set("address", account.Hex())
	params.Set("tag", "pending")
	var result hexutil.Uint64
	if err := etherScan.rpcCall(params, &result); err != nil {
		return 0, err
	}
	return uint64(result), nil
}

// SendTransaction implements rpc.Interface
func (etherScan *EtherScan) SendTransaction(ctx context.Context, tx *types.Transaction) error {
	encodedTx, err := rlp.EncodeToBytes(tx)
	if err != nil {
		return errp.WithStack(err)
	}

	params := url.Values{}
	params.Set("action", "eth_sendRawTransaction")
	params.Set("hex", hexutil.Encode(encodedTx))
	return etherScan.rpcCall(params, nil)
}

// SubscribeFilterLogs implements rpc.Interface
func (etherScan *EtherScan) SubscribeFilterLogs(ctx context.Context, q ethereum.FilterQuery, ch chan<- types.Log) (ethereum.Subscription, error) {
	panic("not implemented")
}

// SuggestGasPrice implements rpc.Interface
func (etherScan *EtherScan) SuggestGasPrice(ctx context.Context) (*big.Int, error) {
	params := url.Values{}
	params.Set("action", "eth_gasPrice")
	var result hexutil.Big
	if err := etherScan.rpcCall(params, &result); err != nil {
		return nil, err
	}
	return (*big.Int)(&result), nil
}

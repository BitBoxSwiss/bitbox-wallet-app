// SPDX-License-Identifier: Apache-2.0

package etherscan

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"golang.org/x/time/rate"
)

// CallsPerSec is thenumber of etherscanr equests allowed
// per second.
// Etherscan rate limits to one request per 0.2 seconds.
var CallsPerSec = 3.8

const (
	maxAddressesForBalances = 20
)

// ERC20GasErr is the error message returned from etherscan when there is not enough ETH to pay the transaction fee.
const ERC20GasErr = "insufficient funds for gas * price + value"

// EtherScan is a rate-limited etherscan api client. See https://etherscan.io/apis.
type EtherScan struct {
	url        string
	httpClient *http.Client
	limiter    *rate.Limiter
	chainId    string
}

// NewEtherScan creates a new instance of EtherScan.
func NewEtherScan(chainId string, httpClient *http.Client, limiter *rate.Limiter) *EtherScan {
	return &EtherScan{
		url:        "https://etherscan-api.shiftcrypto.io/v2/api",
		httpClient: httpClient,
		limiter:    limiter,
		chainId:    chainId,
	}
}

func (etherScan *EtherScan) call(ctx context.Context, params url.Values, result interface{}) error {
	if err := etherScan.limiter.Wait(ctx); err != nil {
		return errp.WithStack(err)
	}
	params.Set("chainId", etherScan.chainId)
	response, err := etherScan.httpClient.Get(etherScan.url + "?" + params.Encode())
	if err != nil {
		return errp.WithStack(err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return errp.Newf("expected 200 OK, got %d", response.StatusCode)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return errp.WithStack(err)
	}
	if err := json.Unmarshal(body, result); err != nil {
		return errp.Newf("unexpected response from EtherScan: %s", string(body))
	}
	return nil
}

type jsonBigInt big.Int

func (jsBigInt *jsonBigInt) BigInt() *big.Int {
	bigInt := big.Int(*jsBigInt)
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
	// We use this to compute the number of confirmations, not the "confirmations" field, as the
	// latter is not present in the API result of txlistinternal (internal transactions).
	BlockNumber jsonBigInt     `json:"blockNumber"`
	GasUsed     jsonBigInt     `json:"gasUsed"`
	GasPrice    jsonBigInt     `json:"gasPrice"`
	Nonce       jsonBigInt     `json:"nonce"`
	Hash        common.Hash    `json:"hash"`
	Timestamp   timestamp      `json:"timeStamp"`
	From        common.Address `json:"from"`
	Failed      string         `json:"isError"`

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
	blockTipHeight  *big.Int
	// isInternal: true if tx was fetched via `txlistinternal`, false if via `txlist`.
	isInternal bool
	// internal transactions can send to the same receive address multiple times in the same
	// transaction, and they should all show up as separate transactions. They all have the same
	// transaction hash, so we track duplicate IDs via a counter so the internal ID stays unique.
	idIndex int
}

// TransactionData returns the tx data to be shown to the user.
func (tx *Transaction) TransactionData(isERC20 bool) *accounts.TransactionData {
	timestamp := time.Time(tx.jsonTransaction.Timestamp)
	nonce := tx.jsonTransaction.Nonce.BigInt().Uint64()
	return &accounts.TransactionData{
		Fee:                      tx.fee(),
		FeeIsDifferentUnit:       isERC20,
		Timestamp:                &timestamp,
		TxID:                     tx.TxID(),
		InternalID:               tx.internalID(),
		Height:                   int(tx.jsonTransaction.BlockNumber.BigInt().Uint64()),
		NumConfirmations:         tx.numConfirmations(),
		NumConfirmationsComplete: ethtypes.NumConfirmationsComplete,
		Status:                   tx.status(),
		Type:                     tx.txType,
		Amount:                   tx.amount(),
		Addresses:                tx.addresses(),
		Gas:                      tx.jsonTransaction.GasUsed.BigInt().Uint64(),
		Nonce:                    &nonce,
		IsErc20:                  isERC20,
	}
}

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

func (tx *Transaction) fee() *coin.Amount {
	if tx.isInternal {
		// EtherScan always returns 0 for gasUsed and contains no gasPrice for internal txs.
		return nil
	}
	fee := new(big.Int).Mul(tx.jsonTransaction.GasUsed.BigInt(), tx.jsonTransaction.GasPrice.BigInt())
	amount := coin.NewAmount(fee)
	return &amount
}

// TxID returns the transaction ID.
func (tx *Transaction) TxID() string {
	return tx.jsonTransaction.Hash.Hex()
}

func (tx *Transaction) internalID() string {
	id := tx.TxID()
	if tx.isInternal {
		id += fmt.Sprintf("-internal-%d", tx.idIndex)
	}
	return id
}

func (tx *Transaction) numConfirmations() int {
	confs := 0
	txHeight := tx.jsonTransaction.BlockNumber.BigInt().Uint64()
	tipHeight := tx.blockTipHeight.Uint64()
	if tipHeight > 0 {
		confs = int(tipHeight - txHeight + 1)
	}
	return confs
}

func (tx *Transaction) status() accounts.TxStatus {
	if tx.jsonTransaction.Failed == "1" {
		return accounts.TxStatusFailed
	}
	if tx.numConfirmations() >= ethtypes.NumConfirmationsComplete {
		return accounts.TxStatusComplete
	}
	return accounts.TxStatusPending
}

func (tx *Transaction) amount() coin.Amount {
	return coin.NewAmount(tx.jsonTransaction.Value.BigInt())
}

func (tx *Transaction) addresses() []accounts.AddressAndAmount {
	address := ""
	if tx.jsonTransaction.to != nil {
		address = tx.jsonTransaction.to.Hex()
	} else if tx.jsonTransaction.contractAddress != nil {
		address = tx.jsonTransaction.contractAddress.Hex()
	}
	return []accounts.AddressAndAmount{{
		Address: address,
		Amount:  tx.amount(),
	}}
}

// prepareTransactions casts to []accounts.Transactions and sets the transaction type (send,
// receive, send to self) based on the account address.
func prepareTransactions(
	isERC20 bool,
	blockTipHeight *big.Int,
	isInternal bool,
	transactions []*Transaction, address common.Address) ([]*accounts.TransactionData, error) {
	seen := map[string]int{}
	castTransactions := []*accounts.TransactionData{}
	ours := address.Hex()
	for _, transaction := range transactions {
		seenIdx := seen[transaction.TxID()]
		seen[transaction.TxID()] = seenIdx + 1

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
		transaction.blockTipHeight = blockTipHeight
		transaction.isInternal = isInternal
		transaction.idIndex = seenIdx
		castTransactions = append(castTransactions, transaction.TransactionData(isERC20))
	}
	return castTransactions, nil
}

// Transactions queries EtherScan for transactions for the given account, until endBlock.
// Provide erc20Token to filter for those. If nil, standard etheruem transactions will be fetched.
func (etherScan *EtherScan) Transactions(
	blockTipHeight *big.Int,
	address common.Address, endBlock *big.Int, erc20Token *erc20.Token) (
	[]*accounts.TransactionData, error) {
	params := url.Values{}
	params.Set("module", "account")
	if erc20Token != nil {
		params.Set("action", "tokentx")
		params.Set("contractaddress", erc20Token.ContractAddress().Hex())
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
	if err := etherScan.call(context.TODO(), params, &result); err != nil {
		return nil, err
	}
	isERC20 := erc20Token != nil
	transactionsNormal, err := prepareTransactions(isERC20, blockTipHeight, false, result.Result, address)
	if err != nil {
		return nil, err
	}
	var transactionsInternal []*accounts.TransactionData
	if erc20Token == nil {
		// Also show internal transactions.
		params.Set("action", "txlistinternal")
		resultInternal := struct {
			Result []*Transaction
		}{}
		if err := etherScan.call(context.TODO(), params, &resultInternal); err != nil {
			return nil, err
		}
		var err error
		transactionsInternal, err = prepareTransactions(
			isERC20, blockTipHeight, true, resultInternal.Result, address)
		if err != nil {
			return nil, err
		}
	}
	return append(transactionsNormal, transactionsInternal...), nil
}

// ----- RPC node proxy methods follow

func (etherScan *EtherScan) rpcCall(ctx context.Context, params url.Values, result interface{}) error {
	params.Set("module", "proxy")

	var wrapped struct {
		JSONRPC string `json:"jsonrpc"`
		ID      int    `json:"id"`
		Error   *struct {
			Message string `json:"message"`
		} `json:"error"`
		Result *json.RawMessage `json:"result"`
	}
	if err := etherScan.call(ctx, params, &wrapped); err != nil {
		return err
	}
	if wrapped.Error != nil {
		return errp.New(wrapped.Error.Message)
	}
	if result == nil {
		return nil
	}
	if wrapped.Result == nil {
		return errp.New("expected result")
	}
	if err := json.Unmarshal(*wrapped.Result, result); err != nil {
		return errp.Newf("unexpected response from EtherScan: %s", string(*wrapped.Result))
	}
	return nil
}

// TransactionReceiptWithBlockNumber implements rpc.Interface.
func (etherScan *EtherScan) TransactionReceiptWithBlockNumber(
	ctx context.Context, hash common.Hash) (*rpcclient.RPCTransactionReceipt, error) {
	params := url.Values{}
	params.Set("action", "eth_getTransactionReceipt")
	params.Set("txhash", hash.Hex())
	var result *rpcclient.RPCTransactionReceipt
	if err := etherScan.rpcCall(ctx, params, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// TransactionByHash implements rpc.Interface.
func (etherScan *EtherScan) TransactionByHash(
	ctx context.Context, hash common.Hash) (*types.Transaction, bool, error) {
	params := url.Values{}
	params.Set("action", "eth_getTransactionByHash")
	params.Set("txhash", hash.Hex())
	var result rpcclient.RPCTransaction
	if err := etherScan.rpcCall(ctx, params, &result); err != nil {
		return nil, false, err
	}
	return &result.Transaction, result.BlockNumber == nil, nil
}

// BlockNumber implements rpc.Interface.
func (etherScan *EtherScan) BlockNumber(ctx context.Context) (*big.Int, error) {
	params := url.Values{}
	params.Set("action", "eth_getBlockByNumber")
	params.Set("tag", "latest")
	params.Set("boolean", "false")
	var header *types.Header
	if err := etherScan.rpcCall(ctx, params, &header); err != nil {
		return nil, err
	}
	return header.Number, nil
}

// Balance implements rpc.Interface.
func (etherScan *EtherScan) Balance(ctx context.Context, account common.Address) (*big.Int, error) {
	var result struct {
		Status  string
		Message string
		Result  string
	}

	params := url.Values{}
	params.Set("module", "account")
	params.Set("action", "balance")
	params.Set("address", account.Hex())
	params.Set("tag", "latest")
	if err := etherScan.call(ctx, params, &result); err != nil {
		return nil, err
	}
	if result.Status != "1" {
		return nil, errp.New("unexpected response from EtherScan")
	}
	balance, ok := new(big.Int).SetString(result.Result, 10)
	if !ok {
		return nil, errp.New("unexpected response from EtherScan")
	}
	return balance, nil
}

// Balances returns the balances for multiple addresses.
func (etherScan *EtherScan) Balances(ctx context.Context, accounts []common.Address) (map[common.Address]*big.Int, error) {
	if len(accounts) == 0 {
		return nil, nil
	}

	params := url.Values{}
	params.Set("module", "account")
	params.Set("action", "balancemulti")
	params.Set("tag", "latest")

	balances := make(map[common.Address]*big.Int)

	type balancesResult struct {
		Status  string
		Message string
		Result  []struct {
			Account string     `json:"account"`
			Balance jsonBigInt `json:"balance"`
		} `json:"result"`
	}

	for addressesChunk := range slices.Chunk(accounts, maxAddressesForBalances) {

		addresses := make([]string, len(addressesChunk))
		for i, account := range addressesChunk {
			addresses[i] = account.Hex()
		}

		params.Set("address", strings.Join(addresses, ","))

		result := balancesResult{}
		if err := etherScan.call(ctx, params, &result); err != nil {
			return nil, err
		}
		if result.Status != "1" {
			return nil, errp.New("unexpected response from EtherScan")
		}

		for _, item := range result.Result {
			account := common.HexToAddress(item.Account)
			balance := item.Balance.BigInt()
			balances[account] = balance
		}
	}
	return balances, nil
}

// ERC20Balance implements rpc.Interface.
func (etherScan *EtherScan) ERC20Balance(account common.Address, erc20Token *erc20.Token) (*big.Int, error) {
	var result struct {
		Status  string
		Message string
		Result  string
	}

	params := url.Values{}
	params.Set("module", "account")
	params.Set("action", "tokenbalance")
	params.Set("address", account.Hex())
	params.Set("contractaddress", erc20Token.ContractAddress().Hex())
	params.Set("tag", "latest")
	if err := etherScan.call(context.TODO(), params, &result); err != nil {
		return nil, err
	}
	if result.Status != "1" {
		return nil, errp.New("unexpected response from EtherScan")
	}
	balance, ok := new(big.Int).SetString(result.Result, 10)
	if !ok {
		return nil, errp.New("unexpected response from EtherScan")
	}
	return balance, nil
}

// CallContract implements rpc.Interface.
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
	if err := etherScan.rpcCall(ctx, params, &result); err != nil {
		return nil, err
	}
	return result, nil
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

// EstimateGas implements rpc.Interface.
func (etherScan *EtherScan) EstimateGas(ctx context.Context, msg ethereum.CallMsg) (uint64, error) {
	params := url.Values{}
	params.Set("action", "eth_estimateGas")
	callMsgParams(&params, msg)

	var result hexutil.Uint64
	if err := etherScan.rpcCall(ctx, params, &result); err != nil {
		return 0, err
	}
	return uint64(result), nil
}

// PendingNonceAt implements rpc.Interface.
func (etherScan *EtherScan) PendingNonceAt(ctx context.Context, account common.Address) (uint64, error) {
	params := url.Values{}
	params.Set("action", "eth_getTransactionCount")
	params.Set("address", account.Hex())
	params.Set("tag", "pending")
	var result hexutil.Uint64
	if err := etherScan.rpcCall(ctx, params, &result); err != nil {
		return 0, err
	}
	return uint64(result), nil
}

// SendTransaction implements rpc.Interface.
func (etherScan *EtherScan) SendTransaction(ctx context.Context, tx *types.Transaction) error {
	encodedTx, err := tx.MarshalBinary() // canonical RLP encoding, works for legacy and EIP-1559 txs
	if err != nil {
		return errp.WithStack(err)
	}

	params := url.Values{}
	params.Set("action", "eth_sendRawTransaction")
	params.Set("hex", hexutil.Encode(encodedTx))
	return etherScan.rpcCall(ctx, params, nil)
}

// SuggestGasPrice implements rpc.Interface.
func (etherScan *EtherScan) SuggestGasPrice(ctx context.Context) (*big.Int, error) {
	params := url.Values{}
	params.Set("action", "eth_gasPrice")
	var result hexutil.Big
	if err := etherScan.rpcCall(ctx, params, &result); err != nil {
		return nil, err
	}
	return (*big.Int)(&result), nil
}

// SuggestGasTipCap implements rpc.Interface.
func (etherScan *EtherScan) SuggestGasTipCap(ctx context.Context) (*big.Int, error) {
	return nil, errp.New("not implemented")
}

// FeeTargets returns three priorities with fee targets estimated by Etherscan
// https://docs.etherscan.io/api-endpoints/gas-tracker#get-gas-oracle
// FeeTargets implements rpc.Interface.
// Note: This is not a true RPC but a custom Etherscan API call which implements their own fee estimation.
func (etherScan *EtherScan) FeeTargets(ctx context.Context) ([]*ethtypes.FeeTarget, error) {
	// TODO: Use timeout.
	var result struct {
		// Values are in Gwei*10
		Result struct {
			High    string `json:"FastGasPrice"`
			Normal  string `json:"ProposeGasPrice"`
			Low     string `json:"SafeGasPrice"`
			BaseFee string `json:"suggestBaseFee"`
		} `json:"result"`
	}
	params := url.Values{}
	params.Set("module", "gastracker")
	params.Set("action", "gasoracle")
	if err := etherScan.call(ctx, params, &result); err != nil {
		return nil, err
	}
	// Convert string fields to int64
	high, err := strconv.ParseInt(result.Result.High, 10, 64)
	if err != nil {
		return nil, err
	}

	normal, err := strconv.ParseInt(result.Result.Normal, 10, 64)
	if err != nil {
		return nil, err
	}

	low, err := strconv.ParseInt(result.Result.Low, 10, 64)
	if err != nil {
		return nil, err
	}

	baseFee, err := strconv.ParseFloat(result.Result.BaseFee, 64)
	if err != nil {
		return nil, err
	}
	// Conversion from Gwei to Wei.
	factor := big.NewInt(1e9)

	baseFeeWei := new(big.Int).Mul(big.NewInt(int64(baseFee)), factor)
	highFeeCap := new(big.Int).Mul(big.NewInt(high), factor)
	normalFeeCap := new(big.Int).Mul(big.NewInt(normal), factor)
	lowFeeCap := new(big.Int).Mul(big.NewInt(low), factor)

	if baseFeeWei.Cmp(highFeeCap) >= 0 || baseFeeWei.Cmp(normalFeeCap) >= 0 || baseFeeWei.Cmp(lowFeeCap) >= 0 {
		return nil, errp.New("baseFeeWei must be smaller than GasFeeCap")
	}

	return []*ethtypes.FeeTarget{
		{
			TargetCode: accounts.FeeTargetCodeHigh,
			GasFeeCap:  highFeeCap,
			GasTipCap:  new(big.Int).Sub(highFeeCap, baseFeeWei),
		},
		{
			TargetCode: accounts.FeeTargetCodeNormal,
			GasFeeCap:  normalFeeCap,
			GasTipCap:  new(big.Int).Sub(normalFeeCap, baseFeeWei),
		},
		{
			TargetCode: accounts.FeeTargetCodeLow,
			GasFeeCap:  lowFeeCap,
			GasTipCap:  new(big.Int).Sub(lowFeeCap, baseFeeWei),
		},
	}, nil
}

// SPDX-License-Identifier: Apache-2.0

package etherscan

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
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

// requestTimeout bounds a single etherscan HTTP request (measured after a rate-limiter slot is
// acquired). It is a package var so tests can shorten it; the default is generous for Tor and for
// large txlist response bodies.
var requestTimeout = 60 * time.Second

const (
	maxAddressesForBalances   = 20
	maxGetRequestTargetLength = 6000
)

// PageSizeThreshold is the number of returned records at or above which a list response is treated
// as potentially truncated and pagination continues. Soundness requires PageSizeThreshold <= the
// server's actual cap: a too-high threshold reads a capped page as complete (silent truncation); a
// too-low threshold only costs extra (deduplicated) pages. It is a var so tests can shrink it.
var PageSizeThreshold = 10000

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
	return etherScan.callWithMethod(ctx, http.MethodGet, params, result)
}

func (etherScan *EtherScan) callWithMethod(
	ctx context.Context,
	method string,
	params url.Values,
	result interface{},
) error {
	if err := etherScan.limiter.Wait(ctx); err != nil {
		return errp.WithStack(err)
	}
	// Bound each request after acquiring a rate-limiter slot, so time queued behind the limiter
	// does not eat the request budget. The deadline covers connect, headers, and body read
	// (io.ReadAll respects the request context), so a single stalled connection can no longer wedge
	// the caller (and its account lock / bbolt tx) indefinitely.
	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()
	params.Set("chainId", etherScan.chainId)
	encodedParams := params.Encode()
	requestURL := etherScan.url
	var requestBody io.Reader
	if method == http.MethodGet {
		requestURL += "?" + encodedParams
	} else {
		requestBody = strings.NewReader(encodedParams)
	}
	request, err := http.NewRequestWithContext(ctx, method, requestURL, requestBody)
	if err != nil {
		return errp.WithStack(err)
	}
	if method == http.MethodPost {
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	response, err := etherScan.httpClient.Do(request)
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

// shouldPostRPC returns true when the encoded request would exceed the GET
// request target length the upstream proxy accepts; the caller falls back to
// POST in that case.
func (etherScan *EtherScan) shouldPostRPC(params url.Values) bool {
	candidate := maps.Clone(params)
	candidate.Set("chainId", etherScan.chainId)
	return len(candidate.Encode()) > maxGetRequestTargetLength
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
	if tx.jsonTransaction.ToAsString != "" {
		if !common.IsHexAddress(tx.jsonTransaction.ToAsString) {
			return errp.Newf("eth address expected, got %s", tx.jsonTransaction.ToAsString)
		}
		addr := common.HexToAddress(tx.jsonTransaction.ToAsString)
		tx.jsonTransaction.to = &addr
	}
	if tx.jsonTransaction.ContractAddressAsString != "" {
		if !common.IsHexAddress(tx.jsonTransaction.ContractAddressAsString) {
			return errp.Newf("eth address expected, got %s", tx.jsonTransaction.ContractAddressAsString)
		}
		addr := common.HexToAddress(tx.jsonTransaction.ContractAddressAsString)
		tx.jsonTransaction.contractAddress = &addr
	}
	if tx.jsonTransaction.to == nil && tx.jsonTransaction.contractAddress == nil {
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
	switch {
	case tx.isInternal:
		id += fmt.Sprintf("-internal-%d", tx.idIndex)
	case tx.idIndex > 0:
		// Multiple token-transfer logs can share a tx hash; disambiguate so InternalID stays unique
		// across all three list endpoints (txlist rows are one-per-hash, so idIndex is 0 for them).
		// idIndex is positional (arrival order within the fetched page); as with -internal-N, this
		// assumes Etherscan returns same-hash rows in a stable order. If two same-hash token rows
		// were ever reordered between fetches, their InternalIDs would swap — a display/notes-order
		// effect only, and strictly better than the previous behaviour where they collided.
		id += fmt.Sprintf("-token-%d", tx.idIndex)
	}
	return id
}

func (tx *Transaction) numConfirmations() int {
	confs := 0
	txHeight := tx.jsonTransaction.BlockNumber.BigInt().Uint64()
	tipHeight := tx.blockTipHeight.Uint64()
	// Clamp: if the reported tip lags below the tx height (a lagging proxy node), render pending
	// rather than underflowing the uint64 subtraction into a huge confirmation count.
	if tipHeight > 0 && tipHeight >= txHeight {
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

// txListParams describes a module=account list query for fetchTxList.
type txListParams struct {
	action          string // "txlist" | "txlistinternal" | "tokentx"
	address         common.Address
	contractAddress *common.Address // tokentx contract filter; nil = unfiltered
	startBlock      *big.Int        // inclusive; big.NewInt(0) = full history
	endBlock        *big.Int        // inclusive
}

// fetchTxList pages through a module=account list endpoint using an endblock cursor (sort=desc),
// deduplicating page-boundary overlaps by occurrence counting (see tokenTransactionDedupKey — the
// key distinguishes distinct rows, and per-page occurrence counting preserves legitimate same-hash
// duplicates within one page while skipping repeats already emitted on earlier pages).
//
// It returns the transactions in server order and, if pagination stalled on a block carrying
// >= PageSizeThreshold records, truncatedBelow = that block height B: results are complete for
// heights > B and possibly partial for heights <= B. truncatedBelow == nil means the window
// [startBlock, endBlock] is complete.
func (etherScan *EtherScan) fetchTxList(ctx context.Context, p txListParams) (
	[]*Transaction, *big.Int, error) {
	params := url.Values{}
	params.Set("module", "account")
	params.Set("action", p.action)
	if p.contractAddress != nil {
		params.Set("contractaddress", p.contractAddress.Hex())
	}
	params.Set("startblock", p.startBlock.Text(10))
	params.Set("tag", "latest")
	params.Set("sort", "desc") // desc by block number
	params.Set("address", p.address.Hex())

	endBlockCursor := new(big.Int).Set(p.endBlock)
	// Etherscan pagination can repeat items at page boundaries (same endblock, desc order). We dedup
	// by counting occurrences of a stable key across pages and, on each new page, skipping only as
	// many occurrences as we already emitted. This avoids collapsing multiple identical logs from
	// the same transaction within a single page, which we cannot distinguish further because
	// Etherscan does not return a logIndex.
	seenCounts := map[string]int{}
	var txs []*Transaction
	for {
		params.Set("endblock", endBlockCursor.Text(10))
		result := struct {
			Result []*Transaction
		}{}
		if err := etherScan.call(ctx, params, &result); err != nil {
			return nil, nil, err
		}
		if len(result.Result) == 0 {
			break
		}

		newCount := 0
		consumed := map[string]int{}   // per page: previously-emitted occurrences skipped per key
		pageCounts := map[string]int{} // per page: new occurrences accepted per key
		for _, transaction := range result.Result {
			key := tokenTransactionDedupKey(transaction)
			if seenCounts[key] > consumed[key] {
				consumed[key]++
				continue
			}
			pageCounts[key]++
			newCount++
			txs = append(txs, transaction)
		}
		for key, count := range pageCounts {
			seenCounts[key] += count
		}

		if len(result.Result) < PageSizeThreshold {
			break
		}
		if newCount == 0 {
			// A full page yielded no new records: >= PageSizeThreshold rows share endBlockCursor's
			// block and cannot be paged past. Everything strictly above it was fully paged; the
			// window at and below it may be incomplete.
			return txs, new(big.Int).Set(endBlockCursor), nil
		}
		lastTx := result.Result[len(result.Result)-1]
		endBlockCursor = lastTx.jsonTransaction.BlockNumber.BigInt()
	}
	return txs, nil, nil
}

// maxBoundary returns the higher of two truncation boundaries, treating nil as "no truncation".
func maxBoundary(a, b *big.Int) *big.Int {
	switch {
	case a == nil:
		return b
	case b == nil:
		return a
	case a.Cmp(b) >= 0:
		return a
	default:
		return b
	}
}

// Transactions queries EtherScan for transactions for the given account in [startBlock, endBlock].
// Provide erc20Token to filter for those. If nil, standard ethereum transactions (txlist plus
// internal txs) are fetched. The returned truncatedBelow is non-nil if the history is incomplete
// below that block height (see fetchTxList).
func (etherScan *EtherScan) Transactions(
	ctx context.Context,
	blockTipHeight *big.Int,
	address common.Address, startBlock, endBlock *big.Int, erc20Token *erc20.Token) (
	[]*accounts.TransactionData, *big.Int, error) {
	isERC20 := erc20Token != nil

	p := txListParams{address: address, startBlock: startBlock, endBlock: endBlock}
	if isERC20 {
		p.action = "tokentx"
		contractAddress := erc20Token.ContractAddress()
		p.contractAddress = &contractAddress
	} else {
		p.action = "txlist"
	}
	normalTxs, truncatedBelow, err := etherScan.fetchTxList(ctx, p)
	if err != nil {
		return nil, nil, err
	}
	transactionsNormal, err := prepareTransactions(isERC20, blockTipHeight, false, normalTxs, address)
	if err != nil {
		return nil, nil, err
	}

	var transactionsInternal []*accounts.TransactionData
	if !isERC20 {
		// Also show internal transactions.
		pInternal := p
		pInternal.action = "txlistinternal"
		internalTxs, internalTruncatedBelow, err := etherScan.fetchTxList(ctx, pInternal)
		if err != nil {
			return nil, nil, err
		}
		transactionsInternal, err = prepareTransactions(isERC20, blockTipHeight, true, internalTxs, address)
		if err != nil {
			return nil, nil, err
		}
		truncatedBelow = maxBoundary(truncatedBelow, internalTruncatedBelow)
	}
	return append(transactionsNormal, transactionsInternal...), truncatedBelow, nil
}

func tokenTransactionDedupKey(tx *Transaction) string {
	contractAddress := tx.jsonTransaction.ContractAddressAsString
	if tx.jsonTransaction.contractAddress != nil {
		contractAddress = tx.jsonTransaction.contractAddress.Hex()
	}
	blockNumber := tx.jsonTransaction.BlockNumber.BigInt()
	gasUsed := tx.jsonTransaction.GasUsed.BigInt()
	gasPrice := tx.jsonTransaction.GasPrice.BigInt()
	nonce := tx.jsonTransaction.Nonce.BigInt()
	value := tx.jsonTransaction.Value.BigInt()
	timestamp := time.Time(tx.jsonTransaction.Timestamp).Unix()
	to := ""
	if tx.jsonTransaction.to != nil {
		to = tx.jsonTransaction.to.Hex()
	}
	from := tx.jsonTransaction.From.Hex()
	return fmt.Sprintf(
		"%s-%s-%s-%s-%s-%s-%s-%s-%s-%d-%s",
		tx.TxID(),
		contractAddress,
		from,
		to,
		blockNumber.Text(10),
		nonce.Text(10),
		gasUsed.Text(10),
		gasPrice.Text(10),
		value.Text(10),
		timestamp,
		tx.jsonTransaction.Failed,
	)
}

// TokenTransactionsByContract queries EtherScan for all token transfers for the given account in
// [startBlock, endBlock], grouped by token contract address. It uses the tokentx endpoint without a
// contract address filter, paginating and deduplicating via fetchTxList. The returned truncatedBelow
// is non-nil if the history is incomplete below that block height.
func (etherScan *EtherScan) TokenTransactionsByContract(
	ctx context.Context,
	blockTipHeight *big.Int,
	address common.Address, startBlock, endBlock *big.Int) (
	map[common.Address][]*accounts.TransactionData, *big.Int, error) {
	txs, truncatedBelow, err := etherScan.fetchTxList(ctx, txListParams{
		action:     "tokentx",
		address:    address,
		startBlock: startBlock,
		endBlock:   endBlock,
	})
	if err != nil {
		return nil, nil, err
	}

	grouped := map[common.Address][]*Transaction{}
	for _, transaction := range txs {
		if transaction.jsonTransaction.contractAddress == nil {
			return nil, nil, errp.New("token tx missing contract address")
		}
		contractAddress := *transaction.jsonTransaction.contractAddress
		grouped[contractAddress] = append(grouped[contractAddress], transaction)
	}

	byContract := map[common.Address][]*accounts.TransactionData{}
	for contractAddress, transactions := range grouped {
		castTransactions, err := prepareTransactions(true, blockTipHeight, false, transactions, address)
		if err != nil {
			return nil, nil, err
		}
		byContract[contractAddress] = castTransactions
	}
	return byContract, truncatedBelow, nil
}

// ----- RPC node proxy methods follow

// rpcCallRaw performs a module=proxy JSON-RPC call and returns the raw result message. It surfaces
// JSON-RPC and transport errors. A `{"result": null}` response yields a nil message with no error,
// which callers interpret as "not found".
func (etherScan *EtherScan) rpcCallRaw(ctx context.Context, params url.Values) (*json.RawMessage, error) {
	params.Set("module", "proxy")

	var wrapped struct {
		JSONRPC string `json:"jsonrpc"`
		ID      int    `json:"id"`
		Error   *struct {
			Message string `json:"message"`
		} `json:"error"`
		Result *json.RawMessage `json:"result"`
	}
	method := http.MethodGet
	if etherScan.shouldPostRPC(params) {
		method = http.MethodPost
	}
	if err := etherScan.callWithMethod(ctx, method, params, &wrapped); err != nil {
		return nil, err
	}
	if wrapped.Error != nil {
		return nil, errp.New(wrapped.Error.Message)
	}
	return wrapped.Result, nil
}

func (etherScan *EtherScan) rpcCall(ctx context.Context, params url.Values, result interface{}) error {
	raw, err := etherScan.rpcCallRaw(ctx, params)
	if err != nil {
		return err
	}
	if result == nil {
		return nil
	}
	if raw == nil {
		return errp.New("expected result")
	}
	if err := json.Unmarshal(*raw, result); err != nil {
		return errp.Newf("unexpected response from EtherScan: %s", string(*raw))
	}
	return nil
}

// rpcCallNullable behaves like rpcCall but treats a JSON-RPC null result ({"result": null}) as a
// meaningful "not found" (found=false, err=nil) rather than an error. Used by the lookups whose
// null result means the node does not know the transaction, so a transient transport error can be
// told apart from an authoritative absence.
func (etherScan *EtherScan) rpcCallNullable(ctx context.Context, params url.Values, result interface{}) (found bool, err error) {
	raw, err := etherScan.rpcCallRaw(ctx, params)
	if err != nil {
		return false, err
	}
	if raw == nil {
		return false, nil
	}
	if err := json.Unmarshal(*raw, result); err != nil {
		return false, errp.Newf("unexpected response from EtherScan: %s", string(*raw))
	}
	return true, nil
}

// TransactionReceiptWithBlockNumber implements rpc.Interface. It returns ethereum.NotFound if the
// node has no receipt for the hash (e.g. a still-pending or dropped tx).
func (etherScan *EtherScan) TransactionReceiptWithBlockNumber(
	ctx context.Context, hash common.Hash) (*rpcclient.RPCTransactionReceipt, error) {
	params := url.Values{}
	params.Set("action", "eth_getTransactionReceipt")
	params.Set("txhash", hash.Hex())
	var result *rpcclient.RPCTransactionReceipt
	found, err := etherScan.rpcCallNullable(ctx, params, &result)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, ethereum.NotFound
	}
	return result, nil
}

// TransactionByHash implements rpc.Interface. It returns ethereum.NotFound if the node does not
// know the transaction at all.
func (etherScan *EtherScan) TransactionByHash(
	ctx context.Context, hash common.Hash) (*types.Transaction, bool, error) {
	params := url.Values{}
	params.Set("action", "eth_getTransactionByHash")
	params.Set("txhash", hash.Hex())
	var result rpcclient.RPCTransaction
	found, err := etherScan.rpcCallNullable(ctx, params, &result)
	if err != nil {
		return nil, false, err
	}
	if !found {
		return nil, false, ethereum.NotFound
	}
	return &result.Transaction, result.BlockNumber == nil, nil
}

// BlockNumber implements rpc.Interface.
func (etherScan *EtherScan) BlockNumber(ctx context.Context) (*big.Int, error) {
	// eth_blockNumber returns just the latest block number (a ~40-byte response), instead of
	// eth_getBlockByNumber which downloads the full block header (logsBloom, extraData, ...) only
	// for the number.
	params := url.Values{}
	params.Set("action", "eth_blockNumber")
	var result hexutil.Big
	if err := etherScan.rpcCall(ctx, params, &result); err != nil {
		return nil, err
	}
	return (*big.Int)(&result), nil
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

// gweiStringToWei converts a decimal gwei string (e.g. "0.663812392471") to wei, flooring any
// sub-wei remainder. Rejects negative and rational ("2/3") inputs. Note big.Rat.SetString also
// accepts exponent forms ("6.63e-1"); these convert correctly and are accepted.
func gweiStringToWei(s string) (*big.Int, error) {
	if strings.ContainsRune(s, '/') {
		return nil, errp.Newf("invalid gwei value %q", s)
	}
	rat, ok := new(big.Rat).SetString(s)
	if !ok || rat.Sign() < 0 {
		return nil, errp.Newf("invalid gwei value %q", s)
	}
	// Conversion from Gwei to Wei.
	rat.Mul(rat, new(big.Rat).SetInt64(1e9))
	return new(big.Int).Quo(rat.Num(), rat.Denom()), nil // Quo on non-negatives == floor
}

// FeeTargets returns three priorities with fee targets estimated by Etherscan
// https://docs.etherscan.io/api-endpoints/gas-tracker#get-gas-oracle
// FeeTargets implements rpc.Interface.
// Note: This is not a true RPC but a custom Etherscan API call which implements their own fee estimation.
func (etherScan *EtherScan) FeeTargets(ctx context.Context) ([]*ethtypes.FeeTarget, error) {
	var result struct {
		// Values are in Gwei, possibly fractional.
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

	highFeeCap, err := gweiStringToWei(result.Result.High)
	if err != nil {
		return nil, err
	}
	normalFeeCap, err := gweiStringToWei(result.Result.Normal)
	if err != nil {
		return nil, err
	}
	lowFeeCap, err := gweiStringToWei(result.Result.Low)
	if err != nil {
		return nil, err
	}
	baseFeeWei, err := gweiStringToWei(result.Result.BaseFee)
	if err != nil {
		return nil, err
	}

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

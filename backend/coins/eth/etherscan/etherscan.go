package etherscan

import (
	"encoding/json"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/ethereum/go-ethereum/common"
)

// etherscan rate limits to one request per 5 seconds.
var callInterval = 5100 * time.Millisecond

// EtherScan is a rate-limited etherscan api client. See https://etherscan.io/apis.
type EtherScan struct {
	url         string
	rateLimiter <-chan time.Time
}

// NewEtherScan creates a new instance of EtherScan.
func NewEtherScan(url string) *EtherScan {
	return &EtherScan{
		url:         url,
		rateLimiter: time.After(0), // 0 so the first call does not wait.
	}
}

func (etherScan *EtherScan) call(params url.Values, result interface{}) error {
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
	To            common.Address `json:"to"`
	Value         jsonBigInt     `json:"value"`
}

// Transaction implemements coin.Transaction (TODO).
type Transaction struct {
	jsonTransaction jsonTransaction
	txType          coin.TxType
}

// UnmarshalJSON implements json.Unmarshaler.
func (tx *Transaction) UnmarshalJSON(jsonBytes []byte) error {
	return json.Unmarshal(jsonBytes, &tx.jsonTransaction)
}

// Fee implements coin.Transaction.
func (tx *Transaction) Fee() *coin.Amount {
	fee := new(big.Int).Mul(tx.jsonTransaction.GasUsed.BigInt(), tx.jsonTransaction.GasPrice.BigInt())
	amount := coin.NewAmount(fee)
	return &amount
}

// Timestamp implements coin.Transaction.
func (tx *Transaction) Timestamp() *time.Time {
	t := time.Time(tx.jsonTransaction.Timestamp)
	return &t
}

// ID implements coin.Transaction.
func (tx *Transaction) ID() string {
	return tx.jsonTransaction.Hash.Hex()
}

// NumConfirmations implements coin.Transaction.
func (tx *Transaction) NumConfirmations() int {
	return int(tx.jsonTransaction.Confirmations.BigInt().Int64())
}

// Type implements coin.Transaction.
func (tx *Transaction) Type() coin.TxType {
	return tx.txType
}

// Amount implements coin.Transaction.
func (tx *Transaction) Amount() coin.Amount {
	return coin.NewAmount(tx.jsonTransaction.Value.BigInt())
}

// Addresses implements coin.Transaction.
func (tx *Transaction) Addresses() []string {
	return []string{tx.jsonTransaction.To.Hex()}
}

// prepareTransactions casts to []coin.Transactions and removes duplicate entries. Duplicate entries
// appear in the etherscan result if the recipient and sender are the same. It also sets the
// transaction type (send, receive, send to self) based on the account address.
func prepareTransactions(
	transactions []*Transaction, address common.Address) ([]coin.Transaction, error) {
	seen := map[string]struct{}{}
	castTransactions := []coin.Transaction{}
	ours := address.Hex()
	for _, transaction := range transactions {
		if _, ok := seen[transaction.ID()]; ok {
			continue
		}
		seen[transaction.ID()] = struct{}{}

		from := transaction.jsonTransaction.From.Hex()
		to := transaction.jsonTransaction.To.Hex()
		if ours != from && ours != to {
			return nil, errp.New("transaction does not belong to our account")
		}
		if ours == from && ours == to {
			transaction.txType = coin.TxTypeSendSelf
		} else if ours == from {
			transaction.txType = coin.TxTypeSend
		} else {
			transaction.txType = coin.TxTypeReceive
		}

		castTransactions = append(castTransactions, transaction)
	}
	return castTransactions, nil
}

// Transactions queries EtherScan for transactions for the given account, until endBlock.
func (etherScan *EtherScan) Transactions(address common.Address, endBlock *big.Int) (
	[]coin.Transaction, error) {
	params := url.Values{}
	params.Set("module", "account")
	params.Set("action", "txlist")
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

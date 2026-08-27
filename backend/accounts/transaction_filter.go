// SPDX-License-Identifier: Apache-2.0

package accounts

import (
	"math/big"
	"sort"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// TransactionSortBy selects the transaction field used for sorting.
type TransactionSortBy string

const (
	// TransactionSortByDate sorts by confirmation time, with pending transactions treated as newest.
	TransactionSortByDate TransactionSortBy = "date"
	// TransactionSortByAmount sorts by the displayed coin amount.
	TransactionSortByAmount TransactionSortBy = "amount"
	// TransactionSortByType sorts by transaction type.
	TransactionSortByType TransactionSortBy = "type"
)

// TransactionSortDirection selects ascending or descending order.
type TransactionSortDirection string

const (
	// TransactionSortDirectionAscending sorts from smallest/oldest to largest/newest.
	TransactionSortDirectionAscending TransactionSortDirection = "asc"
	// TransactionSortDirectionDescending sorts from largest/newest to smallest/oldest.
	TransactionSortDirectionDescending TransactionSortDirection = "desc"
)

// TransactionFilterParams contains the serialized transaction-list filters accepted by the API.
type TransactionFilterParams struct {
	Search   string
	FromDate string
	ToDate   string
	Type     string
	SortBy   string
	SortDir  string
}

// TransactionFilter contains validated transaction-list filtering and sorting options.
type TransactionFilter struct {
	search  string
	from    *time.Time
	to      *time.Time
	txType  *TxType
	sortBy  TransactionSortBy
	sortDir TransactionSortDirection
}

// NewTransactionFilter validates serialized transaction-list filter parameters.
func NewTransactionFilter(params TransactionFilterParams, location *time.Location) (TransactionFilter, error) {
	filter := TransactionFilter{
		search:  strings.ToLower(strings.TrimSpace(params.Search)),
		sortBy:  TransactionSortByDate,
		sortDir: TransactionSortDirectionDescending,
	}

	if params.FromDate != "" {
		from, err := time.ParseInLocation(time.DateOnly, params.FromDate, location)
		if err != nil {
			return TransactionFilter{}, errp.Newf("invalid transaction from date: %q", params.FromDate)
		}
		filter.from = &from
	}
	if params.ToDate != "" {
		to, err := time.ParseInLocation(time.DateOnly, params.ToDate, location)
		if err != nil {
			return TransactionFilter{}, errp.Newf("invalid transaction to date: %q", params.ToDate)
		}
		endOfDay := to.AddDate(0, 0, 1).Add(-time.Nanosecond)
		filter.to = &endOfDay
	}

	switch params.Type {
	case "", "all":
	case "receive":
		txType := TxTypeReceive
		filter.txType = &txType
	case "send":
		txType := TxTypeSend
		filter.txType = &txType
	case "send_to_self":
		txType := TxTypeSendSelf
		filter.txType = &txType
	default:
		return TransactionFilter{}, errp.Newf("invalid transaction type: %q", params.Type)
	}

	if params.SortBy != "" {
		filter.sortBy = TransactionSortBy(params.SortBy)
	}
	if filter.sortBy != TransactionSortByDate && filter.sortBy != TransactionSortByAmount && filter.sortBy != TransactionSortByType {
		return TransactionFilter{}, errp.Newf("invalid transaction sort field: %q", params.SortBy)
	}
	if params.SortDir != "" {
		filter.sortDir = TransactionSortDirection(params.SortDir)
	}
	if filter.sortDir != TransactionSortDirectionAscending && filter.sortDir != TransactionSortDirectionDescending {
		return TransactionFilter{}, errp.Newf("invalid transaction sort direction: %q", params.SortDir)
	}

	return filter, nil
}

// Apply returns a filtered and stably sorted copy of txs.
func (filter TransactionFilter) Apply(
	txs OrderedTransactions,
	accountCoin coin.Coin,
	txNote func(string) string,
	now time.Time,
) OrderedTransactions {
	result := make(OrderedTransactions, 0, len(txs))
	for _, tx := range txs {
		if filter.matches(tx, txNote, now) {
			result = append(result, tx)
		}
	}

	sort.SliceStable(result, func(i, j int) bool {
		comparison := filter.compare(result[i], result[j], accountCoin)
		if filter.sortDir == TransactionSortDirectionDescending {
			return comparison > 0
		}
		return comparison < 0
	})
	return result
}

func (filter TransactionFilter) matches(
	tx *TransactionData,
	txNote func(string) string,
	now time.Time,
) bool {
	if filter.search != "" && !filter.matchesSearch(tx, txNote) {
		return false
	}
	txTime := tx.Timestamp
	if txTime == nil {
		txTime = &now
	}
	if filter.from != nil && txTime.Before(*filter.from) {
		return false
	}
	if filter.to != nil && txTime.After(*filter.to) {
		return false
	}
	if filter.txType != nil && tx.Type != *filter.txType {
		return false
	}
	return true
}

func (filter TransactionFilter) matchesSearch(tx *TransactionData, txNote func(string) string) bool {
	if strings.Contains(strings.ToLower(tx.TxID), filter.search) {
		return true
	}
	for _, address := range tx.Addresses {
		if strings.Contains(strings.ToLower(address.Address), filter.search) {
			return true
		}
	}
	return txNote != nil && strings.Contains(strings.ToLower(txNote(tx.InternalID)), filter.search)
}

func (filter TransactionFilter) compare(a, b *TransactionData, accountCoin coin.Coin) int {
	switch filter.sortBy {
	case TransactionSortByAmount:
		aAmount := displayedCoinAmount(a, accountCoin)
		bAmount := displayedCoinAmount(b, accountCoin)
		return aAmount.Cmp(bAmount)
	case TransactionSortByType:
		return strings.Compare(transactionTypeAPIValue(a.Type), transactionTypeAPIValue(b.Type))
	default:
		if a.Timestamp == nil && b.Timestamp == nil {
			return 0
		}
		if a.Timestamp == nil {
			return 1
		}
		if b.Timestamp == nil {
			return -1
		}
		if a.Timestamp.Before(*b.Timestamp) {
			return -1
		}
		if a.Timestamp.After(*b.Timestamp) {
			return 1
		}
		return 0
	}
}

func displayedCoinAmount(tx *TransactionData, accountCoin coin.Coin) *big.Rat {
	amount := tx.Amount
	if tx.Type != TxTypeReceive {
		amount = tx.DeductedAmount
	}
	value := formattedCoinAmount(amount, accountCoin)
	return value.Abs(value)
}

func formattedCoinAmount(amount coin.Amount, accountCoin coin.Coin) *big.Rat {
	value, ok := new(big.Rat).SetString(accountCoin.FormatAmount(amount, false))
	if !ok {
		return new(big.Rat)
	}
	return value
}

func transactionTypeAPIValue(txType TxType) string {
	switch txType {
	case TxTypeReceive:
		return "receive"
	case TxTypeSend:
		return "send"
	case TxTypeSendSelf:
		return "send_to_self"
	default:
		return string(txType)
	}
}

// SPDX-License-Identifier: Apache-2.0

package accounts

import (
	"math/big"
	"sort"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// TransactionFilterAmountUnit selects the unit used for amount bounds.
type TransactionFilterAmountUnit string

const (
	// TransactionFilterAmountUnitCoin applies bounds in the account's display coin unit.
	TransactionFilterAmountUnitCoin TransactionFilterAmountUnit = "coin"
	// TransactionFilterAmountUnitFiat applies bounds in the selected fiat currency.
	TransactionFilterAmountUnitFiat TransactionFilterAmountUnit = "fiat"
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
	FromDate   string
	ToDate     string
	Type       string
	AmountMin  string
	AmountMax  string
	AmountUnit string
	Fiat       string
	SortBy     string
	SortDir    string
}

// TransactionFilter contains validated transaction-list filtering and sorting options.
type TransactionFilter struct {
	from       *time.Time
	to         *time.Time
	txType     *TxType
	amountMin  *big.Rat
	amountMax  *big.Rat
	amountUnit TransactionFilterAmountUnit
	fiat       string
	sortBy     TransactionSortBy
	sortDir    TransactionSortDirection
}

// NewTransactionFilter validates serialized transaction-list filter parameters.
func NewTransactionFilter(params TransactionFilterParams, location *time.Location) (TransactionFilter, error) {
	filter := TransactionFilter{
		amountUnit: TransactionFilterAmountUnitFiat,
		sortBy:     TransactionSortByDate,
		sortDir:    TransactionSortDirectionDescending,
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

	var err error
	filter.amountMin, err = parseTransactionAmountBound(params.AmountMin)
	if err != nil {
		return TransactionFilter{}, err
	}
	filter.amountMax, err = parseTransactionAmountBound(params.AmountMax)
	if err != nil {
		return TransactionFilter{}, err
	}

	if params.AmountUnit != "" {
		filter.amountUnit = TransactionFilterAmountUnit(params.AmountUnit)
	}
	if filter.amountUnit != TransactionFilterAmountUnitCoin && filter.amountUnit != TransactionFilterAmountUnitFiat {
		return TransactionFilter{}, errp.Newf("invalid transaction amount unit: %q", params.AmountUnit)
	}
	filter.fiat = params.Fiat
	if filter.amountUnit == TransactionFilterAmountUnitFiat &&
		(filter.amountMin != nil || filter.amountMax != nil) && filter.fiat == "" {
		return TransactionFilter{}, errp.New("fiat currency is required for transaction amount filtering")
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

func parseTransactionAmountBound(value string) (*big.Rat, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	bound, ok := new(big.Rat).SetString(value)
	if !ok || bound.Sign() < 0 {
		return nil, errp.Newf("invalid transaction amount bound: %q", value)
	}
	return bound, nil
}

// Apply returns a filtered and stably sorted copy of txs.
func (filter TransactionFilter) Apply(
	txs OrderedTransactions,
	accountCoin coin.Coin,
	rateUpdater *rates.RateUpdater,
	now time.Time,
) OrderedTransactions {
	result := make(OrderedTransactions, 0, len(txs))
	for _, tx := range txs {
		if filter.matches(tx, accountCoin, rateUpdater, now) {
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
	accountCoin coin.Coin,
	rateUpdater *rates.RateUpdater,
	now time.Time,
) bool {
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
	if filter.amountMin == nil && filter.amountMax == nil {
		return true
	}

	value := filter.displayAmount(tx, accountCoin, rateUpdater)
	if value == nil {
		return false
	}
	value.Abs(value)
	return (filter.amountMin == nil || value.Cmp(filter.amountMin) >= 0) &&
		(filter.amountMax == nil || value.Cmp(filter.amountMax) <= 0)
}

func (filter TransactionFilter) displayAmount(
	tx *TransactionData,
	accountCoin coin.Coin,
	rateUpdater *rates.RateUpdater,
) *big.Rat {
	amount := tx.Amount
	if tx.Type != TxTypeReceive {
		amount = tx.DeductedAmount
	}
	if filter.amountUnit == TransactionFilterAmountUnitCoin {
		return formattedCoinAmount(amount, accountCoin)
	}

	formatted := amount.FormatWithConversionsAtTime(accountCoin, tx.Timestamp, rateUpdater)
	conversion := strings.ReplaceAll(formatted.Conversions[filter.fiat], "'", "")
	value, ok := new(big.Rat).SetString(conversion)
	if !ok {
		return nil
	}
	return value
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

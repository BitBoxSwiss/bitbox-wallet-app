package blockbook

import (
	"encoding/json"
	"math/big"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// TxStatus represents the status of a transaction in the Blockbook API.
type TxStatus int

const (
	// TxStatusPending indicates that the transaction is pending.
	TxStatusPending TxStatus = -1
	// TxStatusOK indicates that the transaction is complete and successful.
	TxStatusOK TxStatus = 1
	// TxStatusFailure indicates that the transaction has failed.
	TxStatusFailure TxStatus = 0
)

// TokenTransfer represents a token transfer in a transaction.
type TokenTransfer struct {
	Type     string `json:"type"`
	From     string `json:"from"`
	To       string `json:"to"`
	Contract string `json:"contract"`
	Value    Amount `json:"value"`
}

// Vin represents an input in a transaction.
type Vin struct {
	Txid      string   `json:"txid"`
	Addresses []string `json:"addresses"`
}

// Vout represents an output in a transaction.
type Vout struct {
	Txid      string   `json:"txid,omitempty"`
	Value     Amount   `json:"value"`
	Addresses []string `json:"addresses"`
}

// Amount is a wrapper to big.Int to handle JSON unmarshalling.
type Amount struct {
	*big.Int
}

// UnmarshalJSON implements the json.Unmarshaler interface for Amount.
func (a *Amount) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return errp.WithStack(err)
	}
	intValue, ok := new(big.Int).SetString(s, 10)
	if !ok {
		return errp.Newf("could not parse amount %q", s)
	}
	a.Int = intValue
	return nil
}

// Tx holds information about a transaction.
type Tx struct {
	Txid             string            `json:"txid"`
	Vin              []Vin             `json:"vin"`
	Vout             []Vout            `json:"vout"`
	Blockhash        string            `json:"blockHash,omitempty"`
	Blockheight      int               `json:"blockHeight"`
	Confirmations    uint32            `json:"confirmations"`
	Blocktime        int64             `json:"blockTime"`
	ValueOutSat      Amount            `json:"value"`
	ValueInSat       Amount            `json:"valueIn,omitempty"`
	FeesSat          Amount            `json:"fees,omitempty"`
	TokenTransfers   []TokenTransfer   `json:"tokenTransfers,omitempty"`
	EthereumSpecific *EthereumSpecific `json:"ethereumSpecific,omitempty"`
}

// EthereumSpecific contains ethereum specific transaction data.
type EthereumSpecific struct {
	Status   TxStatus `json:"status"`
	Nonce    uint64   `json:"nonce"`
	GasLimit *big.Int `json:"gasLimit"`
	GasUsed  *big.Int `json:"gasUsed,omitempty"`
	GasPrice Amount   `json:"gasPrice,omitempty"`
}

// Amount returns the total amount of the transaction.
func (tx *Tx) Amount(address string, isERC20 bool) coin.Amount {
	if isERC20 {
		for _, transfer := range tx.TokenTransfers {
			if transfer.Type == "ERC20" {
				if transfer.To == address || transfer.From == address {
					return coin.NewAmount(transfer.Value.Int)
				}
			}
		}
	}
	return coin.NewAmount(tx.ValueOutSat.Int)
}

// Addresses returns the receiving address of the transaction.
func (tx *Tx) Addresses(isERC20 bool) ([]accounts.AddressAndAmount, error) {
	var address string
	switch {
	case isERC20:
		address = tx.TokenTransfers[0].To
	case len(tx.Vout) > 0:
		address = tx.Vout[0].Addresses[0]
	default:
		return nil, errp.New("transaction has no outputs or token transfers")
	}

	return []accounts.AddressAndAmount{{
		Address: address,
		Amount:  tx.Amount(address, isERC20),
	}}, nil
}

// Status returns the status of the transaction.
func (tx *Tx) Status() (accounts.TxStatus, error) {
	switch tx.EthereumSpecific.Status {
	case TxStatusPending:
		return accounts.TxStatusPending, nil
	case TxStatusOK:
		return accounts.TxStatusComplete, nil
	case TxStatusFailure:
		return accounts.TxStatusFailed, nil
	default:
		// This should never happen
		return "", errp.Newf("unknown transaction status %d", tx.EthereumSpecific.Status)
	}
}

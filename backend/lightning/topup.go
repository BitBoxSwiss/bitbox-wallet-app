// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"math/big"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountErrors "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	btcutil "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	backendutil "github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/wire/v2"
)

const minimumTopUpAmountSat = 1000

const errLightningBalanceLimitExceeded errp.ErrorCode = "lightningBalanceLimitExceeded"

type prepareTopUpRequest struct {
	SourceAccountCode accountsTypes.Code `json:"sourceAccountCode"`
	Amount            string             `json:"amount"`
	FeeTarget         string             `json:"feeTarget"`
	CustomFee         string             `json:"customFee"`
	SendAll           string             `json:"sendAll"`
	SelectedUTXOs     []string           `json:"selectedUTXOs"`
	ExpectedAddress   string             `json:"expectedAddress"`
}

type topUpProposal struct {
	Amount                  coin.FormattedAmountWithConversions `json:"amount"`
	Fee                     coin.FormattedAmountWithConversions `json:"fee"`
	Total                   coin.FormattedAmountWithConversions `json:"total"`
	RecipientDisplayAddress string                              `json:"recipientDisplayAddress"`
}

type topUpFundingLimitError struct {
	fundingLimit fundingLimit
}

func (err *topUpFundingLimitError) Error() string {
	return string(errLightningBalanceLimitExceeded)
}

func parseTopUpAmount(accountCoin coin.Coin, amount string) (coin.Amount, error) {
	unit := coin.DecimalsExp(accountCoin, false)
	if accountCoin.GetFormatUnit(false) == string(coin.BtcUnitSats) {
		unit = big.NewInt(1)
	}
	return coin.NewSendAmount(amount).Amount(unit, true)
}

func validateTopUpAmount(amount coin.Amount) error {
	minimumTopUpAmount := big.NewInt(minimumTopUpAmountSat)
	if amount.BigInt().Cmp(minimumTopUpAmount) < 0 {
		return &lightningAmountBelowMinimumError{minAmountSat: minimumTopUpAmountSat}
	}
	return nil
}

// PrepareTopUp validates the Lightning funding limit and creates the Bitcoin transaction proposal
// that will be signed by the existing account send flow.
func (lightning *Lightning) PrepareTopUp(request prepareTopUpRequest) (*topUpProposal, error) {
	account, err := lightning.getAccount(request.SourceAccountCode)
	if err != nil {
		return nil, err
	}
	if account.Coin().Code() != coin.CodeBTC {
		return nil, errp.Newf("account %q is not a Bitcoin mainnet account", request.SourceAccountCode)
	}

	if request.SendAll != "" && request.SendAll != "yes" && request.SendAll != "no" {
		return nil, accountErrors.ErrInvalidAmount
	}
	sendAmount := coin.NewSendAmount(request.Amount)
	var amount coin.Amount
	if request.SendAll == "yes" {
		sendAmount = coin.NewSendAmountAll()
	} else {
		amount, err = parseTopUpAmount(account.Coin(), request.Amount)
		if err != nil {
			return nil, err
		}
		if err := validateTopUpAmount(amount); err != nil {
			return nil, err
		}
	}
	_, limit, err := lightning.balanceWithFundingLimit()
	if err != nil {
		return nil, err
	}
	validateOutputAmount := func(amount coin.Amount) error {
		if err := validateTopUpAmount(amount); err != nil {
			return err
		}
		if amount.BigInt().Cmp(big.NewInt(limit.MarginSat)) > 0 {
			return &topUpFundingLimitError{fundingLimit: limit}
		}
		return nil
	}
	if !sendAmount.SendAll() {
		if err := validateOutputAmount(amount); err != nil {
			return nil, err
		}
	}
	selectedUTXOs := make(map[wire.OutPoint]struct{}, len(request.SelectedUTXOs))
	for _, value := range request.SelectedUTXOs {
		outPoint, err := btcutil.ParseOutPoint([]byte(value))
		if err != nil {
			return nil, err
		}
		selectedUTXOs[*outPoint] = struct{}{}
	}

	feeTarget, err := accounts.NewFeeTargetCode(request.FeeTarget)
	if err != nil {
		return nil, err
	}
	customFee := ""
	if feeTarget == accounts.FeeTargetCodeCustom {
		customFee = request.CustomFee
	}
	boardingAddress, err := lightning.BoardingAddress()
	if err != nil {
		return nil, err
	}
	if request.ExpectedAddress != "" && request.ExpectedAddress != boardingAddress {
		return nil, accountErrors.ErrInvalidAddress
	}

	outputAmount, fee, total, err := account.TxProposal(&accounts.TxProposalArgs{
		RecipientAddress:     boardingAddress,
		Amount:               sendAmount,
		FeeTargetCode:        feeTarget,
		CustomFee:            customFee,
		SelectedUTXOs:        selectedUTXOs,
		ValidateOutputAmount: validateOutputAmount,
	})
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to create Lightning top-up transaction proposal")
	}

	accountConfig := account.Config()
	return &topUpProposal{
		Amount:                  outputAmount.FormatWithConversions(account.Coin(), false, accountConfig.RateUpdater),
		Fee:                     fee.FormatWithConversions(account.Coin(), true, accountConfig.RateUpdater),
		Total:                   total.FormatWithConversions(account.Coin(), false, accountConfig.RateUpdater),
		RecipientDisplayAddress: backendutil.FormatAddress(account.Coin().Code(), boardingAddress),
	}, nil
}

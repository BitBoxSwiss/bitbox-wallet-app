// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"math/big"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	backendutil "github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

const errLightningBalanceLimitExceeded errp.ErrorCode = "lightningBalanceLimitExceeded"

type prepareTopUpRequest struct {
	SourceAccountCode accountsTypes.Code `json:"sourceAccountCode"`
	Amount            string             `json:"amount"`
	FeeTarget         string             `json:"feeTarget"`
	CustomFee         string             `json:"customFee"`
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
	return coin.NewSendAmount(amount).Amount(unit, false)
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

	amount, err := parseTopUpAmount(account.Coin(), request.Amount)
	if err != nil {
		return nil, err
	}
	_, limit, err := lightning.balanceWithFundingLimit()
	if err != nil {
		return nil, err
	}
	if amount.BigInt().Cmp(big.NewInt(limit.MarginSat)) > 0 {
		return nil, &topUpFundingLimitError{fundingLimit: limit}
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

	outputAmount, fee, total, err := account.TxProposal(&accounts.TxProposalArgs{
		RecipientAddress: boardingAddress,
		Amount:           coin.NewSendAmount(request.Amount),
		FeeTargetCode:    feeTarget,
		CustomFee:        customFee,
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

// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/stretchr/testify/require"
)

func TestToLightningPayment(t *testing.T) {
	description := "invoice description"
	preimage := "preimage"
	details := breez_sdk_spark.PaymentDetailsLightning{
		Description: &description,
		Preimage:    &preimage,
		Invoice:     "lnbc1invoice",
		PaymentHash: "hash",
	}
	var paymentDetails breez_sdk_spark.PaymentDetails = details

	payment := toLightningPayment(breez_sdk_spark.Payment{
		Id:          "payment-id",
		PaymentType: breez_sdk_spark.PaymentTypeReceive,
		Status:      breez_sdk_spark.PaymentStatusCompleted,
		Amount:      big.NewInt(123),
		Fees:        big.NewInt(4),
		Timestamp:   42,
		Details:     &paymentDetails,
	})

	require.Equal(t, lightningPayment{
		ID:              "payment-id",
		Type:            accounts.TxTypeReceive,
		Status:          accounts.TxStatusComplete,
		AmountSat:       123,
		FeesSat:         4,
		Timestamp:       42,
		Description:     "invoice description",
		PaymentHash:     "hash",
		PaymentPreimage: "preimage",
		Invoice:         "lnbc1invoice",
	}, payment)
}

func TestParseLightningUint(t *testing.T) {
	require.Equal(t, uint64(99), parseLightningUint(big.NewInt(99)))
}

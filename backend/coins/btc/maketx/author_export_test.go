// SPDX-License-Identifier: Apache-2.0

package maketx

import (
	"github.com/btcsuite/btcd/btcutil"
	"github.com/sirupsen/logrus"
)

func TstFeeForSerializeSize(relayFeePerKb btcutil.Amount, txSerializeSize int, log *logrus.Entry) btcutil.Amount {
	return feeForSerializeSize(relayFeePerKb, txSerializeSize, log)
}

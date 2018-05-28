package maketx

import (
	"github.com/btcsuite/btcutil"
	"github.com/sirupsen/logrus"
)

func TstFeeForSerializeSize(relayFeePerKb btcutil.Amount, txSerializeSize int, log *logrus.Entry) btcutil.Amount {
	return feeForSerializeSize(relayFeePerKb, txSerializeSize, log)
}

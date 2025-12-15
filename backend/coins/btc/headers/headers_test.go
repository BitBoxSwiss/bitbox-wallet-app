// SPDX-License-Identifier: Apache-2.0

package headers

import (
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain/mocks"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestClose(t *testing.T) {
	headers := NewHeaders(
		&chaincfg.TestNet3Params,
		&dbMock{},
		&mocks.BlockchainMock{},
		(&logrus.Logger{}).WithField("group", "headers_test"),
	)
	didFinish := make(chan struct{})
	headers.testDownloadFinished = func() {
		close(didFinish)
	}
	headers.Initialize()

	require.NoError(t, headers.Close())
	select {
	case <-didFinish:
	case <-time.After(5 * time.Second):
		require.Fail(t, "did not shut down")
	}

}

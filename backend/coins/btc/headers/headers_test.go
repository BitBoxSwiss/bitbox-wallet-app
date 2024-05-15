// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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

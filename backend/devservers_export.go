// SPDX-License-Identifier: Apache-2.0

package backend

import (
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
)

// DefaultDevServers returns the hardcoded ShiftCrypto dev Electrum server(s). It is exposed for
// internal tooling/scripts, specifically cmd/update_btc_checkpoints.
func DefaultDevServers(code coinpkg.Code) []*config.ServerInfo {
	return defaultDevServers(code)
}

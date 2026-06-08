// SPDX-License-Identifier: Apache-2.0

package headers

// CheckpointJSON represents a single checkpoint as stored in checkpoints.json.
//
// Exported so it can be reused by `cmd/update_btc_checkpoints`.
type CheckpointJSON struct {
	Height int32  `json:"height"`
	Hash   string `json:"hash"`
}

// CheckpointsJSONFile matches the schema of checkpoints.json.
//
// Exported so it can be reused by `cmd/update_btc_checkpoints`.
type CheckpointsJSONFile struct {
	BTC struct {
		Mainnet  CheckpointJSON `json:"mainnet"`
		Testnet3 CheckpointJSON `json:"testnet3"`
	} `json:"btc"`
	LTC struct {
		Mainnet  CheckpointJSON `json:"mainnet"`
		Testnet4 CheckpointJSON `json:"testnet4"`
	} `json:"ltc"`
}

// SPDX-License-Identifier: Apache-2.0

package eth

const sepoliaChainID uint64 = 11155111

// EVMChainCapabilities describes the transaction capabilities of a supported EVM chain.
type EVMChainCapabilities struct {
	SupportsType2Transactions bool
}

var evmChainCapabilities = map[uint64]EVMChainCapabilities{
	1:        {SupportsType2Transactions: true},
	10:       {SupportsType2Transactions: true},
	56:       {SupportsType2Transactions: true},
	100:      {SupportsType2Transactions: true},
	137:      {SupportsType2Transactions: true},
	146:      {SupportsType2Transactions: true},
	999:      {SupportsType2Transactions: true},
	8453:     {SupportsType2Transactions: true},
	42161:    {SupportsType2Transactions: true},
	11155111: {SupportsType2Transactions: true},
}

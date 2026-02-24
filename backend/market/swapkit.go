// SPDX-License-Identifier: Apache-2.0

package market

import "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"

const (
	// SwapKitName is the name of the swap vendor, it is unique among all the supported vendors.
	SwapKitName = "swapkit"
)

// IsSwapKitSupported reports whether SwapKit supports swaps for the provided coin.
func IsSwapKitSupported(_ coin.Code) bool {
	// SwapKit support is not gated per-coin yet.
	return true
}

// SwapKitDeals returns the swap conditions offered by SwapKit.
func SwapKitDeals() *DealsList {
	return &DealsList{
		VendorName: SwapKitName,
		Deals: []*Deal{
			{
				Fee: 0,
			},
		},
	}
}

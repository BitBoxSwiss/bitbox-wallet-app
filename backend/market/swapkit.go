// SPDX-License-Identifier: Apache-2.0

package market

const (
	// SwapKitName is the name of the swap vendor, it is unique among all the supported vendors.
	SwapKitName = "swapkit"
)

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

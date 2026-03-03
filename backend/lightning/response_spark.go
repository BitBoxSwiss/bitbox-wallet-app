// SPDX-License-Identifier: Apache-2.0

package lightning

import "math/big"

func toBigIntString(value *big.Int) string {
	if value == nil {
		return "0"
	}
	return value.String()
}

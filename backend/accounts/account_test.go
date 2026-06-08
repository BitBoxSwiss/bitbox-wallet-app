// SPDX-License-Identifier: Apache-2.0

package accounts

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/stretchr/testify/require"
)

func TestFindAddressListByScriptType(t *testing.T) {
	p2wpkh := signing.ScriptTypeP2WPKH
	p2tr := signing.ScriptTypeP2TR

	addressLists := []AddressList{
		{},
		{ScriptType: &p2wpkh},
		{ScriptType: &p2tr},
	}

	require.Same(t, &addressLists[1], FindAddressListByScriptType(addressLists, signing.ScriptTypeP2WPKH))
	require.Same(t, &addressLists[2], FindAddressListByScriptType(addressLists, signing.ScriptTypeP2TR))
	require.Nil(t, FindAddressListByScriptType(addressLists, signing.ScriptTypeP2WPKHP2SH))
}

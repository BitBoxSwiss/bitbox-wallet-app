// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/stretchr/testify/require"
)

func TestURI(t *testing.T) {
	// Links must survive without an account, SDK, or frontend subscription.
	lightning := &Lightning{}
	require.Equal(t, uriRequest{}, lightning.URI())
	lightning.HandleURI("lightning:lnbc1first")
	first := lightning.URI()
	require.NotNil(t, first.Input)
	require.Equal(t, "lnbc1first", *first.Input)

	var events []uriRequest
	lightning.Observe(func(event observable.Event) {
		require.Equal(t, "lightning/uri", event.Subject)
		require.Equal(t, action.Replace, event.Action)
		events = append(events, event.Object.(uriRequest))
	})
	lightning.HandleURI("lightning:lnbc1second")
	second := lightning.URI()
	require.NotNil(t, second.Input)
	require.Equal(t, "lnbc1second", *second.Input)
	require.Equal(t, "lnbc1first", *first.Input)
	require.Greater(t, second.Revision, first.Revision)

	lightning.ClearURI(first.Revision)
	require.Equal(t, second, lightning.URI())
	lightning.ClearURI(second.Revision)
	cleared := lightning.URI()
	require.Nil(t, cleared.Input)
	require.Greater(t, cleared.Revision, second.Revision)
	lightning.ClearURI(second.Revision)
	require.Equal(t, cleared, lightning.URI())
	require.Equal(t, []uriRequest{second, cleared}, events)

	// Clicking the same link again is a new request.
	lightning.HandleURI("lightning:lnbc1second")
	require.Greater(t, lightning.URI().Revision, cleared.Revision)

	// An empty payment input still needs validation and acknowledgement.
	lightning.HandleURI("lightning:")
	empty := lightning.URI()
	require.NotNil(t, empty.Input)
	require.Empty(t, *empty.Input)
	lightning.ClearURI(empty.Revision)
	require.Nil(t, lightning.URI().Input)
}

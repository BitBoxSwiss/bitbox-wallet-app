// SPDX-License-Identifier: Apache-2.0

package banners

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/stretchr/testify/require"
)

func TestInit(t *testing.T) {
	handler := http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		// Test request parameters
		_, err := rw.Write([]byte(`
		{
			"bitbox01": {
				"id": "some-id",
				"message": {
					"en": "some-msg"
				},
				"link": {
					"href": "some-link"
				}
			}
		}
		`))
		require.NoError(t, err)
	})
	server := httptest.NewServer(handler)
	defer server.Close()

	banners := NewBanners(true)
	banners.url = server.URL
	banners.Init(server.Client())
	require.Nil(t, banners.GetMessage(KeyBitBox01))
	banners.Activate(KeyBitBox01)
	msg := banners.GetMessage(KeyBitBox01)

	banners.Observe(func(event observable.Event) {
		require.Equal(
			t,
			observable.Event{
				Subject: "banners/bitbox01",
				Action:  action.Replace,
				Object:  msg,
			},
			event,
		)
	})

	require.Equal(t, "some-id", msg.ID)
	require.Equal(t, map[string]string{"en": "some-msg"}, msg.Message)
	require.NotNil(t, msg.Link)
	require.Equal(t, "some-link", msg.Link.Href)

}

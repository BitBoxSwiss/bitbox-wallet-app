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

	banners := NewBanners()
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

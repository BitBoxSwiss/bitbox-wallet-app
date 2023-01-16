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

package bitbox

import (
	"encoding/base64"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox/relay"
	eventpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device/event"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/assert"
)

const (
	// Use your own values here: Pair your BitBox first with the old desktop app and then retrieve
	// the encryption key and channel ID from the configuration file (on macOS, run the following
	// command: 'cat ~/Library/Application\ Support/bitbox/channel.json') and the TFA test string and
	// xpub echo with the Electron demo app from https://github.com/digitalbitbox/ElectronDemo.
	channelID         = "5wq2CsSzWZmuAtN7d5YcaTCzg76yhTJfcZunmWWYPDJG"
	encryptionKey     = "F32H+9lxwWc0pAqmwhTSWfA+K7jT4cNx8frORb1LXoY="
	authenticationKey = "L8dIdfcgobOdqH+EYgXs9vmZUp9P1UNAXLQ5Jy28yj4="
	tfaTestString     = "5hcaTvjdIm6eb9KZv7wRuPKZQWcRSRsPwJ1rptJJApAes6mVHZ/+RTG6FkA3d3FS"
	xpubEcho          = "Dumx+aTBaR3NHqf4XxT5b7VtstfsJ9XExu5b8ZovZud+dsVmdtULr5AiOp2RkAU11d9TopwSDnT6lz8itr2T66EWixCBu/WkHfRpehVcU+CY5hhr9zfEoxnBrddUg+0zhyTlbq5FryaqCgZT+qnMBvjKN7Zsc3FvKZ0yS5yvus0="
)

func TestChannel(t *testing.T) {
	// Activate once you have configured the constants above and opened the mobile app.
	const skip = true
	if skip {
		t.Skip("manual test")
	}

	encryptionKey, err := base64.StdEncoding.DecodeString(encryptionKey)
	if err != nil {
		panic("Cannot decode the testing encryption key!")
	}

	authenticationKey, err := base64.StdEncoding.DecodeString(authenticationKey)
	if err != nil {
		panic("Cannot decode the testing authentication key!")
	}

	channel := relay.NewChannel(channelID, encryptionKey, authenticationKey, socksproxy.NewSocksProxy(false, ""))

	assert.NoError(t, channel.SendPing())
	assert.NoError(t, channel.WaitForPong(40*time.Second))
	assert.NoError(t, channel.SendPairingTest(tfaTestString))
	time.Sleep(5 * time.Second)
	assert.NoError(t, channel.SendXpubEcho(xpubEcho, "btc-p2pkh"))
}

func TestFinishPairing(t *testing.T) {
	okTempDir := test.TstTempDir("dbb_device_test")
	defer func() { _ = os.RemoveAll(okTempDir) }()

	tt := []struct {
		configDir  string
		wantEvent  eventpkg.Event
		wantPaired bool
	}{
		{okTempDir, EventPairingSuccess, true},
		{"\x00", EventPairingError, false}, // assumes never writable; reconsider if flaky
	}
	for i, test := range tt {
		test := test // avoids referencing the same variable across loop iterations
		t.Run(fmt.Sprintf("%d: %s", i, test.wantEvent), func(t *testing.T) {
			communicationMock := &mocks.CommunicationInterface{}
			dbb := &Device{
				communication:    communicationMock,
				closed:           true, // don't run listenForMobile
				channelConfigDir: test.configDir,
				log:              logging.Get().WithGroup("finish_pairing_test"),
			}
			var event eventpkg.Event
			dbb.onEvent = func(e eventpkg.Event, data interface{}) {
				event = e
			}
			newChan := relay.NewChannelWithRandomKey(socksproxy.NewSocksProxy(false, ""))
			communicationMock.On("SendEncrypt", `{"feature_set":{"pairing":true}}`, "").
				Return(map[string]interface{}{"feature_set": "success"}, nil)
			dbb.finishPairing(newChan)
			if event != test.wantEvent {
				t.Errorf("event = %q; want %q", event, test.wantEvent)
			}
			if paired := dbb.HasMobileChannel(); paired != test.wantPaired {
				t.Errorf("paired = %v; want %v", paired, test.wantPaired)
			}

			if !test.wantPaired {
				return
			}
			storedChan := relay.NewChannelFromConfigFile(test.configDir, socksproxy.NewSocksProxy(false, ""))
			if storedChan == nil {
				t.Fatalf("relay.NewChannelFromConfigFile(%q) returned nil", test.configDir)
			}
			if storedChan.ChannelID != newChan.ChannelID {
				t.Errorf("storedChan.ChannelID = %q; want %q", storedChan.ChannelID, newChan.ChannelID)
			}
		})
	}
}

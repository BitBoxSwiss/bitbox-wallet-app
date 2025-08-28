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

package relay

import (
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/crypto"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/stretchr/testify/assert"
)

const online = false

func TestDeleteAllMessages(t *testing.T) {
	if online {
		assert.NoError(t, DeleteAllMessages(relayServer()))
	}
}

func sendPongAsMobile(channel *Channel) error {
	data := map[string]string{"action": "pong"}
	bytes, err := json.Marshal(data)
	if err != nil {
		return err
	}
	encrypted, err := crypto.EncryptThenMAC(bytes, channel.EncryptionKey, channel.AuthenticationKey)
	if err != nil {
		return err
	}
	content := base64.StdEncoding.EncodeToString(encrypted)

	request := &request{
		server:  relayServer(),
		command: PushMessageCommand,
		sender:  Mobile,
		channel: channel,
		content: &content,
	}

	response, err := request.send()
	if err != nil {
		return err
	}

	return response.getErrorIfNok()
}

func TestPingPong(t *testing.T) {
	if online {
		channel := NewChannelWithRandomKey(*socksproxy.NewSocksProxy(false, ""))
		assert.NoError(t, channel.SendPing())
		assert.NoError(t, sendPongAsMobile(channel))
		assert.NoError(t, channel.WaitForPong(2*time.Second))
	}
}

package relay

import (
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"

	"github.com/shiftdevices/godbb/util/crypto"
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
		channel := NewChannelWithRandomKey()
		assert.NoError(t, channel.SendPing())
		assert.NoError(t, sendPongAsMobile(channel))
		assert.NoError(t, channel.WaitForPong(2*time.Second))
	}
}

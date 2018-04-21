package relay

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/shiftdevices/godbb/util/aes"
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
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}
	content, err := aes.Encrypt(channel.EncryptionKey, jsonBytes)
	if err != nil {
		return err
	}

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

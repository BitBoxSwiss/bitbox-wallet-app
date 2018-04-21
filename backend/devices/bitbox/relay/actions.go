package relay

import (
	"encoding/json"

	"github.com/shiftdevices/godbb/util/aes"
)

// PushMessage pushes the encryption of the given data as JSON to the given server.
func PushMessage(server Server, channel *Channel, data interface{}) error {
	if channel == nil {
		panic("The channel may not be nil.")
	}

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}
	content, err := aes.Encrypt(channel.EncryptionKey, jsonBytes)
	if err != nil {
		return err
	}

	request := &request{
		server:  server,
		command: PushMessageCommand,
		sender:  Desktop,
		channel: channel,
		content: &content,
	}

	response, err := request.send()
	if err != nil {
		return err
	}

	return response.getErrorIfNok()
}

// PullOldestMessage pulls the oldest message on the given channel from the given server.
// If no message is available for ten seconds, then this function returns nil.
func PullOldestMessage(server Server, channel *Channel) ([]byte, error) {
	if channel == nil {
		panic("The channel may not be nil.")
	}

	request := &request{
		server:  server,
		command: PullOldestMessageCommand,
		sender:  Desktop,
		channel: channel,
	}

	response, err := request.send()
	if err != nil {
		return nil, err
	}

	if response.Status == "ok" && response.Data != nil && len(response.Data) > 0 {
		return aes.Decrypt(channel.EncryptionKey, response.Data[0].Payload)
	}

	return nil, response.getErrorIfNok()
}

// DeleteAllMessages deletes all messages in all channels which expired on the given server.
func DeleteAllMessages(server Server) error {
	request := &request{
		server:  server,
		command: DeleteAllMessagesCommand,
		sender:  Desktop,
	}
	_, err := request.send()
	return err
}

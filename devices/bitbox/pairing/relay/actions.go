package relay

import (
	"encoding/json"

	"github.com/shiftdevices/godbb/util/aes"
	"github.com/shiftdevices/godbb/util/errp"
)

// PushMessage pushes the encryption of the given data as JSON to the given server.
func PushMessage(server Server, channel Channel, data interface{}) error {
	if channel == nil {
		panic("The channel may not be nil.")
	}

	json, err := json.Marshal(data)
	if err != nil {
		return err
	}
	content, err := aes.Encrypt(channel.EncryptionKey(), []byte(json))
	if err != nil {
		return err
	}

	request := &request{
		server:  server,
		command: pushMessageCommand,
		sender:  desktop,
		channel: channel,
		content: &content,
	}

	response, err := request.send()
	if err != nil {
		return err
	}

	if response.Status == "nok" {
		return errp.New(*response.Error)
	}

	return nil
}

// PullOldestMessage pulls the oldest message on the given channel from the given server.
// If no message is available for ten seconds, then this function returns nil.
func PullOldestMessage(server Server, channel Channel) ([]byte, error) {
	if channel == nil {
		panic("The channel may not be nil.")
	}

	request := &request{
		server:  server,
		command: pullOldestMessageCommand,
		sender:  desktop,
		channel: channel,
	}

	response, err := request.send()
	if err != nil {
		return nil, err
	}

	if response.Status == "nok" {
		return nil, errp.New(*response.Error)
	}

	if response.Status == "ok" && response.Data != nil && len(response.Data) > 0 {
		return aes.Decrypt(channel.EncryptionKey(), response.Data[0].Payload)
	}

	return nil, nil
}

// DeleteAllMessages deletes all messages in all channels which expired on the given server.
func DeleteAllMessages(server Server) error {
	request := &request{
		server:  server,
		command: deleteAllMessagesCommand,
		sender:  desktop,
	}
	_, err := request.send()
	return err
}

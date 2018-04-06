package pairing

import (
	"encoding/json"
	"reflect"

	"github.com/shiftdevices/godbb/devices/bitbox/pairing/relay"
	"github.com/shiftdevices/godbb/util/errp"
)

// Channel implements an encrypted communication channel between the desktop and the paired mobile.
type Channel struct {
	// ChannelID is the identifier which uniquely identifies the channel between the parties.
	ChannelID string `json:"id"`

	// EncryptionKey is used to encrypt the communication between the desktop and the mobile.
	EncryptionKey []byte `json:"key"`
}

// NewChannel returns a new channel with the given channel identifier and encryption key.
func NewChannel(channelID string, encryptionKey []byte) *Channel {
	return &Channel{
		ChannelID:     channelID,
		EncryptionKey: encryptionKey,
	}
}

// GetChannelID returns the identifier which uniquely identifies the channel between the parties.
func (channel *Channel) GetChannelID() string {
	return channel.ChannelID
}

// GetEncryptionKey returns the key to encrypt the communication between the desktop and the mobile.
func (channel *Channel) GetEncryptionKey() []byte {
	return channel.EncryptionKey
}

// relayServer returns the configured relay server.
// The server is hardcoded for now but can be loaded from the settings in the future.
func relayServer() relay.Server {
	return relay.DefaultServer
}

// waitForMessage waits up to ten seconds for expected message from the paired mobile.
// Returns true if the expected message was retrieved from the relay server and false otherwise.
func (channel *Channel) waitForMessage(expectedMessage map[string]string) (bool, error) {
	message, err := relay.PullOldestMessage(relayServer(), channel)
	if err != nil {
		return false, err
	}
	if message == nil {
		return false, nil
	}
	var receivedMessage map[string]string
	err = json.Unmarshal(message, &receivedMessage)
	if err != nil {
		return false, err
	}
	return reflect.DeepEqual(expectedMessage, receivedMessage), nil
}

// waitForValue waits up to ten seconds for the value with the given name from the mobile.
// Returns nil if no message was available on the relay server or if the message contained
// no value with the given name.
func (channel *Channel) waitForValue(name string) (*string, error) {
	message, err := relay.PullOldestMessage(relayServer(), channel)
	if err != nil {
		return nil, err
	}
	if message == nil {
		return nil, nil
	}
	var object map[string]*string
	if err = json.Unmarshal(message, &object); err != nil {
		return nil, errp.WithStack(err)
	}
	return object[name], nil
}

// WaitForScanningSuccess waits up to ten seconds for a QR code scanning success from the mobile.
// Returns true if the scanning success was retrieved from the relay server and false otherwise.
func (channel *Channel) WaitForScanningSuccess() (bool, error) {
	return channel.waitForMessage(map[string]string{"id": "success"})
}

// WaitForMobilePublicKey waits up to ten seconds for the ECDH public key from the mobile.
// Returns nil if no ECDH public key was available on the relay server.
func (channel *Channel) WaitForMobilePublicKey() (*string, error) {
	return channel.waitForValue("ecdh")
}

// SendVerifyPass sends the verify pass from the BitBox to the paired mobile to finish pairing.
func (channel *Channel) SendVerifyPass(verifyPass string) error {
	return relay.PushMessage(relayServer(), channel, map[string]string{
		"verifypass": verifyPass,
	})
}

// SendPairingTest sends the encrypted test string from the BitBox to the paired mobile.
func (channel *Channel) SendPairingTest(tfaTestString string) error {
	return relay.PushMessage(relayServer(), channel, map[string]string{
		"tfa": tfaTestString,
	})
}

// action describes the JSON object for actions like ping, pong and clear.
type action struct {
	Action string `json:"action"`
}

// SendPing sends a ping to the paired mobile to which it automatically responds with 'pong'.
func (channel *Channel) SendPing() error {
	return relay.PushMessage(relayServer(), channel, &action{"ping"})
}

// WaitForPong waits up to ten seconds for the pong from the paired mobile after sending 'ping'.
// Returns true if the pong was retrieved from the relay server and false otherwise.
func (channel *Channel) WaitForPong() (bool, error) {
	return channel.waitForMessage(map[string]string{"action": "pong"})
}

// SendClear clears the screen of the paired mobile.
func (channel *Channel) SendClear() error {
	return relay.PushMessage(relayServer(), channel, &action{"clear"})
}

// SendXpubEcho sends the encrypted xpub echo from the BitBox to the paired mobile.
func (channel *Channel) SendXpubEcho(xpubEcho string) error {
	return relay.PushMessage(relayServer(), channel, map[string]string{
		"echo": xpubEcho,
		"type": "p2pkh",
	})
}

// SendSigningEcho sends the encrypted signing echo from the BitBox to the paired mobile.
// TODO: Document the format of the transaction or maybe rather format it directly here.
func (channel *Channel) SendSigningEcho(signingEcho string, transaction string) error {
	return relay.PushMessage(relayServer(), channel, map[string]string{
		"echo": signingEcho,
		"tx":   transaction,
	})
}

// WaitForSigningPin waits up to ten seconds for the 2FA signing PIN from the mobile.
// Returns nil if no 2FA signing PIN was available on the relay server.
// Otherwise, the returned value is either the PIN (on confirmation) or "abort" (on cancel).
func (channel *Channel) WaitForSigningPin() (*string, error) {
	return channel.waitForValue("pin")
}

// SendRandomNumberEcho sends the encrypted random number echo from the BitBox to the paired mobile.
func (channel *Channel) SendRandomNumberEcho(randomNumberEcho string) error {
	return relay.PushMessage(relayServer(), channel, map[string]string{
		"echo": randomNumberEcho,
	})
}

// WaitForRandomNumberClear waits up to ten seconds for the random number clear from the mobile.
// Returns true if the random number clear was retrieved from the relay server and false otherwise.
func (channel *Channel) WaitForRandomNumberClear() (bool, error) {
	return channel.waitForMessage(map[string]string{"random": "clear"})
}

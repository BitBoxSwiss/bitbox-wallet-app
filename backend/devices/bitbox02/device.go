package bitbox02

import (
	"crypto/rand"
	"encoding/hex"
	"sync"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/messages"
	devicepkg "github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	keystoreInterface "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/flynn/noise"
	"github.com/golang/protobuf/proto"
	"github.com/sirupsen/logrus"
)

//go:generate protoc --go_out=import_path=messages:. messages/hww.proto

// ProductName is the name of the BitBox02 product.
const ProductName = "bitbox02"

type Communication interface {
	SendFrame(string) error
	ReadFrame() ([]byte, error)
	Close()
}

type Device struct {
	deviceID                  string
	deviceLock                locker.Locker
	communication             Communication
	channelHash               string
	channelHashVerified       *bool
	sendCipher, receiveCipher *noise.CipherState
	mu                        sync.RWMutex
	onEvent                   func(devicepkg.Event, interface{})
	log                       *logrus.Entry
}

func NewDevice(
	deviceID string,
	bootloader bool,
	version *semver.SemVer,
	communication Communication,
) *Device {
	log := logging.Get().WithGroup("device").WithField("deviceID", deviceID)
	log.Info("Plugged in device")
	return &Device{
		deviceID:      deviceID,
		communication: communication,
		log:           log,
	}
}

// Init implements device.Device.
func (device *Device) Init(testing bool) {
	cipherSuite := noise.NewCipherSuite(noise.DH25519, noise.CipherChaChaPoly, noise.HashSHA256)
	keypair, err := cipherSuite.GenerateKeypair(rand.Reader)
	if err != nil {
		panic(err)
	}
	handshake, err := noise.NewHandshakeState(noise.Config{
		CipherSuite:   cipherSuite,
		Random:        rand.Reader,
		Pattern:       noise.HandshakeXX,
		StaticKeypair: keypair,
		Prologue:      []byte("Noise_XX_25519_ChaChaPoly_SHA256"),
		Initiator:     true,
	})
	if err != nil {
		panic(err)
	}
	if err := device.communication.SendFrame("I CAN HAS HANDSHAKE?"); err != nil {
		panic(err)
	}
	responseBytes, err := device.communication.ReadFrame()
	if err != nil {
		panic(err)
	}
	if string(responseBytes) != "OKAY!!" {
		panic(string(responseBytes))
	}
	// do handshake:
	msg, _, _, err := handshake.WriteMessage(nil, nil)
	if err != nil {
		panic(err)
	}
	if err := device.communication.SendFrame(string(msg)); err != nil {
		panic(err)
	}
	responseBytes, err = device.communication.ReadFrame()
	if err != nil {
		panic(err)
	}
	_, _, _, err = handshake.ReadMessage(nil, responseBytes)
	if err != nil {
		panic(err)
	}
	msg, device.sendCipher, device.receiveCipher, err = handshake.WriteMessage(nil, nil)
	if err != nil {
		panic(err)
	}
	if err := device.communication.SendFrame(string(msg)); err != nil {
		panic(err)
	}
	responseBytes, err = device.communication.ReadFrame()
	if err != nil {
		panic(err)
	}
	device.channelHash = hex.EncodeToString(handshake.ChannelBinding()[:8])
}

// ProductName implements device.Device.
func (device *Device) ProductName() string {
	return ProductName
}

// Identifier implements device.Device.
func (device *Device) Identifier() string {
	return device.deviceID
}

// KeystoreForConfiguration implements device.Device.
func (device *Device) KeystoreForConfiguration(configuration *signing.Configuration, cosignerIndex int) keystoreInterface.Keystore {
	return nil
}

// SetOnEvent implements device.Device.
func (device *Device) SetOnEvent(onEvent func(devicepkg.Event, interface{})) {
	device.onEvent = onEvent
}

// Close implements device.Device.
func (device *Device) Close() {
	device.communication.Close()
}

func (device *Device) query(request *messages.Request) (*messages.Response, error) {
	if device.sendCipher == nil {
		return nil, errp.New("handshake must come first")
	}
	requestBytes, err := proto.Marshal(request)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	requestBytesEncrypted := device.sendCipher.Encrypt(nil, nil, requestBytes)
	if err := device.communication.SendFrame(string(requestBytesEncrypted)); err != nil {
		return nil, err
	}
	responseBytes, err := device.communication.ReadFrame()
	if err != nil {
		return nil, err
	}
	responseBytesDecrypted, err := device.receiveCipher.Decrypt(nil, nil, responseBytes)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	response := &messages.Response{}
	if err := proto.Unmarshal(responseBytesDecrypted, response); err != nil {
		return nil, errp.WithStack(err)
	}
	return response, nil
}

func (device *Device) Random() ([]byte, error) {
	request := &messages.Request{
		Type: messages.Request_RANDOM,
		Request: &messages.Request_RandomNumberRequest{
			RandomNumberRequest: &messages.RandomNumberRequest{},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return nil, err
	}
	randomResponse, ok := response.Response.(*messages.Response_RandomNumberResponse)
	if !ok || response.Type != messages.Response_RANDOM {
		return nil, errp.New("expected RandomNumberResponse response")
	}
	return randomResponse.RandomNumberResponse.RandomNumber, nil
}

// fireEvent calls device.onEvent callback if non-nil.
// It blocks for the entire duration of the call.
// The read-only lock is released before calling device.onEvent.
func (device *Device) fireEvent(event devicepkg.Event, data interface{}) {
	device.mu.RLock()
	f := device.onEvent
	device.mu.RUnlock()
	if f != nil {
		f(event, data)
	}
}

func (device *Device) ChannelHash() (string, bool) {
	return device.channelHash, device.channelHashVerified != nil
}

func (device *Device) ChannelHashVerify(ok bool) {
	device.channelHashVerified = &ok
}

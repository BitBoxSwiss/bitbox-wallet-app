package bitbox02

import (
	"encoding/hex"
	"fmt"

	"github.com/davecgh/go-spew/spew"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/messages"
	devicepkg "github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	keystoreInterface "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
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
	deviceID      string
	deviceLock    locker.Locker
	communication Communication
	onEvent       func(devicepkg.Event, interface{})
	log           *logrus.Entry
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
	spew.Dump("INIT")
	resp, err := device.Random()
	if err != nil {
		panic(err)
	}
	fmt.Println(hex.EncodeToString(resp), len(resp))
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
	requestBytes, err := proto.Marshal(request)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	if err := device.communication.SendFrame(string(requestBytes)); err != nil {
		return nil, err
	}
	responseBytes, err := device.communication.ReadFrame()
	if err != nil {
		return nil, err
	}
	response := &messages.Response{}
	if err := proto.Unmarshal(responseBytes, response); err != nil {
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

package bitbox02

import (
	"io"

	"github.com/davecgh/go-spew/spew"
	devicepkg "github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	keystoreInterface "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/sirupsen/logrus"
)

// ProductName is the name of the BitBox02 product.
const ProductName = "bitbox02"

type Device struct {
	deviceID   string
	device     io.ReadWriteCloser
	deviceLock locker.Locker
	onEvent    func(devicepkg.Event, interface{})
	log        *logrus.Entry
}

func NewDevice(
	deviceID string,
	device io.ReadWriteCloser,
	bootloader bool,
	version *semver.SemVer,
) *Device {
	log := logging.Get().WithGroup("device").WithField("deviceID", deviceID)
	log.Info("Plugged in device")
	return &Device{
		deviceID: deviceID,
		device:   device,
		log:      log,
	}
}

// Init implements device.Device.
func (device *Device) Init(testing bool) {
	spew.Dump("INIT")
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
	if err := device.device.Close(); err != nil {
		panic(err)
	}
}

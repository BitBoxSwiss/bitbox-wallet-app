// SPDX-License-Identifier: Apache-2.0

// Package bitbox02 implements the Device and Keystore interfaces to integrate the bitbox02 into the
// app.
package bitbox02

import (
	deviceevent "github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/device/event"
	keystoreInterface "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	bitbox02common "github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/sirupsen/logrus"
)

// If you change these, be sure to check the frontend and other places which assume they are
// constant.
const (
	// BitBox02ProductName is the name of the BitBox02 product.
	BitBox02ProductName = "bitbox02"
	// BitBox02NovaProductName is the name of the BitBox02 Nova product.
	BitBox02NovaProductName = "bitbox02nova"
	// PlatformName is the name of the BitVox02 platform.
	PlatformName = "bitbox02"
)

// Device implements device.Device.
type Device struct {
	firmware.Device
	deviceID    string
	productName string
	log         *logrus.Entry

	observable.Implementation
}

// NewDevice creates a new instance of Device.
func NewDevice(
	deviceID string,
	version *semver.SemVer,
	product bitbox02common.Product,
	config firmware.ConfigInterface,
	communication firmware.Communication,
	opts ...firmware.DeviceOption,
) *Device {
	productName := BitBox02ProductName
	// BitBox02Plus is the internal code name for the BitBox Nova.
	if product == bitbox02common.ProductBitBox02PlusBTCOnly ||
		product == bitbox02common.ProductBitBox02PlusMulti {
		productName = BitBox02NovaProductName
	}
	log := logging.Get().
		WithGroup("device").
		WithField("deviceID", deviceID).
		WithField("productName", productName).
		WithField("product", product)

	log.Info("Plugged in device")
	device := &Device{
		Device: *firmware.NewDevice(
			version,
			&product,
			config,
			communication,
			logger{log},
			opts...,
		),
		deviceID:    deviceID,
		productName: productName,
		log:         log,
	}
	device.Device.SetOnEvent(func(ev firmware.Event, meta interface{}) {
		switch ev {
		case firmware.EventStatusChanged:
			device.Notify(observable.Event{
				Subject: "status",
				Action:  action.Replace,
				Object:  device.Device.Status(),
			})
		default:
			device.Notify(observable.Event{
				Subject: string(ev),
				Action:  action.Replace,
			})
		}

		switch ev {
		case firmware.EventStatusChanged:
			switch device.Device.Status() {
			case firmware.StatusInitialized:
				device.Notify(observable.Event{
					Subject: string(deviceevent.EventKeystoreAvailable),
					Action:  action.Replace,
				})

			}
		}
	})
	return device
}

// Init implements device.Device.
func (device *Device) Init(testing bool) error {
	device.init()
	return nil
}

func (device *Device) init() {
	go func() {
		if err := device.Device.Init(); err != nil {
			device.log.Error("unknown IO error (most likely the device was unplugged)", err)
		}
	}()
}

// ProductName implements device.Device.
func (device *Device) ProductName() string {
	return device.productName
}

// PlatformName implements device.Device.
func (device *Device) PlatformName() string {
	return PlatformName
}

// Identifier implements device.Device.
func (device *Device) Identifier() string {
	return device.deviceID
}

// Keystore implements device.Device.
func (device *Device) Keystore() keystoreInterface.Keystore {
	if device.Status() != firmware.StatusInitialized {
		return nil
	}
	return &keystore{
		device: device,
		log:    device.log,
	}
}

// SetOnEvent implements device.Device.
func (device *Device) SetOnEvent(onEvent func(deviceevent.Event, interface{})) {
}

// Reset factory resets the device.
func (device *Device) Reset() error {
	if err := device.Device.Reset(); err != nil {
		return err
	}
	device.Notify(observable.Event{
		Subject: string(deviceevent.EventKeystoreGone),
		Action:  action.Replace,
	})
	return nil
}

// CreateBackup wraps firmware.Device, but also sending a notification on success.
func (device *Device) CreateBackup() error {
	if err := device.Device.CreateBackup(); err != nil {
		return err
	}
	device.Notify(observable.Event{
		Subject: "backups/list",
		Action:  action.Reload,
	})
	return nil
}

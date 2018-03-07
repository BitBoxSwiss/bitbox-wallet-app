package usb

import (
	"log"
	"regexp"
	"time"

	"github.com/karalabe/hid"
	"github.com/shiftdevices/godbb/devices/bitbox"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/semver"
)

const (
	vendorID  = 0x03eb
	productID = 0x2402
)

// DeviceInfos returns a slice of all found bitbox devices.
func DeviceInfos() []hid.DeviceInfo {
	deviceInfos := []hid.DeviceInfo{}
	for _, deviceInfo := range hid.Enumerate(vendorID, productID) {
		if deviceInfo.Interface != 0 && deviceInfo.UsagePage != 0xffff {
			continue
		}
		// If Enumerate() is called too quickly after a device is inserted, the HID device input
		// report is not yet ready.
		if deviceInfo.Serial == "" || deviceInfo.Product == "" {
			continue
		}
		deviceInfos = append(deviceInfos, deviceInfo)
	}
	return deviceInfos
}

// Manager listens for devices and notifies when a device has been inserted or removed.
type Manager struct {
	device *bitbox.Device

	onRegister   func(bitbox.Interface) error
	onUnregister func(string)
}

// NewManager creates a new Manager. onRegister is called when a device has been
// inserted. onUnregister is called when the device has been removed.
func NewManager(
	onRegister func(bitbox.Interface) error,
	onUnregister func(string),
) *Manager {
	return &Manager{
		onRegister:   onRegister,
		onUnregister: onUnregister,
	}
}

func (manager *Manager) register(deviceInfo hid.DeviceInfo) error {
	bootloader := deviceInfo.Product == "bootloader" || deviceInfo.Product == "Digital Bitbox bootloader"
	match := regexp.MustCompile(`v([0-9]+\.[0-9]+\.[0-9]+)`).FindStringSubmatch(deviceInfo.Serial)
	if len(match) != 2 {
		return errp.Newf("Could not find the firmware version in '%s'.", deviceInfo.Serial)
	}
	firmwareVersion, err := semver.NewSemVerFromString(match[1])
	if err != nil {
		return err
	}

	hidDevice, err := deviceInfo.Open()
	if err != nil {
		return err
	}

	device, err := bitbox.NewDevice(
		deviceInfo.Path,
		bootloader,
		firmwareVersion,
		NewCommunication(hidDevice),
	)
	if err != nil {
		return err
	}
	if err := manager.onRegister(device); err != nil {
		return err
	}
	manager.device = device
	return nil
}

// ListenHID listens for inserted/removed devices forever. Run this in a goroutine.
func (manager *Manager) ListenHID() {
	for {
		deviceInfos := DeviceInfos()

		// Check if device was removed.
		if manager.device != nil {
			found := false
			for _, deviceInfo := range deviceInfos {
				if deviceInfo.Path == manager.device.DeviceID() {
					found = true
					break
				}
			}
			if !found {
				deviceID := manager.device.DeviceID()
				manager.device = nil
				manager.onUnregister(deviceID)
			}
		}

		// Check if device was inserted.
		if len(deviceInfos) > 1 {
			panic("TODO: multiple devices?")
		} else if manager.device == nil && len(deviceInfos) == 1 {
			if err := manager.register(deviceInfos[0]); err != nil {
				log.Println(err)
				return
			}
		}
		time.Sleep(time.Second)
	}
}

package dbbdevice

import (
	"log"
	"time"

	"github.com/karalabe/hid"
	"github.com/shiftdevices/godbb/dbbdevice/communication"
)

// DeviceInfos returns a slice of all found bitbox devices.
func DeviceInfos() []hid.DeviceInfo {
	deviceInfos := []hid.DeviceInfo{}
	for _, deviceInfo := range hid.Enumerate(vendorID, productID) {
		if deviceInfo.Interface == 0 || deviceInfo.UsagePage == 0xffff {
			deviceInfos = append(deviceInfos, deviceInfo)
		}
	}
	return deviceInfos
}

// Manager listens for devices and notifies when a device has been inserted or removed.
type Manager struct {
	device *DBBDevice

	onRegister   func(*DBBDevice) error
	onUnregister func(string)
}

// NewManager creates a new Manager. onRegister is called when a device has been
// inserted. onUnregister is called when the device has been removed.
func NewManager(
	onRegister func(*DBBDevice) error,
	onUnregister func(string),
) *Manager {
	return &Manager{
		onRegister:   onRegister,
		onUnregister: onUnregister,
	}
}

func (manager *Manager) register(deviceInfo hid.DeviceInfo) error {
	hidDevice, err := deviceInfo.Open()
	if err != nil {
		return err
	}
	// Sleep a bit to wait for the device to initialize. Sending commands too early means the
	// internal memory might not be initialized, and we run into the password retry check, requiring
	// a long touch by the user.  TODO: fix in the firmware, then remove this sleep.
	time.Sleep(1 * time.Second)

	device, err := NewDBBDevice(deviceInfo.Path, communication.NewCommunication(hidDevice))
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

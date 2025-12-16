// SPDX-License-Identifier: Apache-2.0

package bridgecommon_test

import (
	"log"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/bridgecommon"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/usb"
	"github.com/stretchr/testify/require"
)

type communication struct{}

func (c communication) Respond(queryID int, response string) {
	log.Println("Respond:", queryID, response)
}

func (c communication) PushNotify(msg string) {
	log.Println("PushNotify:", msg)
}

type environment struct{}

func (e environment) NotifyUser(msg string) {
	log.Println("NotfiyUser:", msg)
}

func (e environment) DeviceInfos() []usb.DeviceInfo {
	return []usb.DeviceInfo{}
}

func (e environment) SystemOpen(url string) error {
	log.Println("SystemOpen:", url)
	return nil
}

func (e environment) UsingMobileData() bool {
	return false
}

func (e environment) NativeLocale() string {
	return ""
}

func (e environment) GetSaveFilename(string) string {
	return ""
}

func (e environment) SetDarkTheme(bool) {
	// nothing to do here.
}

func (e environment) DetectDarkTheme() bool {
	return false
}

func (e environment) Auth() {}

func (e environment) OnAuthSettingChanged(bool) {}

func (e environment) BluetoothConnect(string) {}

// TestServeShutdownServe checks that you can call Serve twice in a row.
func TestServeShutdownServe(t *testing.T) {
	bridgecommon.Serve(
		false,
		false,
		nil,
		communication{},
		environment{},
	)
	bridgecommon.Shutdown()

	done := make(chan struct{})
	go func() {
		bridgecommon.Serve(
			false,
			false,
			nil,
			communication{},
			environment{},
		)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		require.Fail(t, "could not Serve twice")
	}
}

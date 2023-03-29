// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bridgecommon_test

import (
	"log"
	"testing"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bridgecommon"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
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

// TestServeShutdownServe checks that you can call Serve twice in a row.
func TestServeShutdownServe(t *testing.T) {
	bridgecommon.Serve(
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

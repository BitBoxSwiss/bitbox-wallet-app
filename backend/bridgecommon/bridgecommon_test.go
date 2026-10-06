// SPDX-License-Identifier: Apache-2.0

package bridgecommon_test

import (
	"log"
	"os"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/bridgecommon"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/usb"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	appDir, err := os.MkdirTemp("", "bitbox-bridgecommon-test-")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(appDir)
	config.SetAppDir(appDir)
	m.Run()
}

type communication struct {
	responses chan string
}

func (c communication) Respond(queryID int, response string) {
	log.Println("Respond:", queryID, response)
	c.responses <- response
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

func (e environment) NumberFormat() *backend.NumberFormat {
	return nil
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

func (e environment) CanEncryptLightningMnemonic() bool { return false }

func (e environment) StoreLightningEncryptionKey(string, string) error { return nil }

func (e environment) LoadLightningEncryptionKey(string) (string, error) { return "", nil }

func (e environment) DeleteLightningEncryptionKey(string) error { return nil }

func (e environment) BluetoothConnect(string) {}

func (e environment) UserAgentPlatform() string {
	return "linux"
}

// TestServeShutdownServe checks that you can call Serve twice in a row.
func TestServeShutdownServe(t *testing.T) {
	t.Cleanup(bridgecommon.Shutdown)
	comm := communication{responses: make(chan string, 1)}
	getURI := func() string {
		t.Helper()
		bridgecommon.BackendCall(1, `{"method":"GET","endpoint":"lightning/uri"}`)
		select {
		case response := <-comm.responses:
			return response
		case <-time.After(5 * time.Second):
			t.Fatal("no URI response")
			return ""
		}
	}
	// Android can deliver its launch intent before the Go service binds.
	bridgecommon.HandleURI("lightning:lnbc1startup")
	bridgecommon.Serve(
		false,
		false,
		nil,
		comm,
		environment{},
	)
	require.JSONEq(t, `{"revision":1,"input":"lnbc1startup"}`, getURI())
	bridgecommon.HandleURI("lightning:donate@bitcoin.org.hk")
	require.JSONEq(t, `{"revision":2,"input":"donate@bitcoin.org.hk"}`, getURI())
	bridgecommon.Shutdown()

	done := make(chan struct{})
	go func() {
		bridgecommon.Serve(
			false,
			false,
			nil,
			comm,
			environment{},
		)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		require.Fail(t, "could not Serve twice")
	}
	require.JSONEq(t, `{"revision":0,"input":null}`, getURI(), "launch links must not replay after a backend restart")
}

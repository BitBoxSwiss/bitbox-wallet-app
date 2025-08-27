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

package bitbox

import (
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox/relay"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/device/event"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

const (
	deviceID         = "device id"
	pin              = "4321"
	recoveryPassword = "this is a recovery password"
	stretchedKey     = "e3306aa321df2b4ae9ee131b385c19d73d41b92678c554ba9ec1737e6d141381465b881e3fec3d4edda3d93609ca5ec4e625a5a56107ab6e0f5019b199aa0fdb"
)

type dbbTestSuite struct {
	suite.Suite
	mockCommunication *mocks.CommunicationInterface
	mockCommClosed    bool
	configDir         string
	dbb               *Device

	log *logrus.Entry
}

func (s *dbbTestSuite) SetupTest() {
	s.configDir = test.TstTempDir("dbb_device_test")
	s.log = logging.Get().WithGroup("bitbox_test")
	s.mockCommunication = new(mocks.CommunicationInterface)
	s.mockCommunication.On("SendPlain", jsonArgumentMatcher(map[string]interface{}{"ping": ""})).
		Return(map[string]interface{}{"ping": ""}, nil).
		Once()
	s.mockCommunication.On("Close").Run(func(mock.Arguments) {
		s.mockCommClosed = true
	})
	s.mockCommClosed = false
	dbb, err := NewDevice(deviceID, false, /* bootloader */
		lowestSupportedFirmwareVersion, s.configDir, s.mockCommunication, socksproxy.NewSocksProxy(false, ""))
	s.Require().NoError(dbb.Init(true))
	s.Require().NoError(err)
	s.dbb = dbb
}

func (s *dbbTestSuite) TearDownTest() {
	s.dbb.Close()
	_ = os.RemoveAll(s.configDir)
}

func TestDBBTestSuite(t *testing.T) {
	suite.Run(t, &dbbTestSuite{})
}

func (s *dbbTestSuite) TestNewDBBDevice() {
	s.Require().Equal(StatusUninitialized, s.dbb.Status())
}

func (s *dbbTestSuite) TestDeviceID() {
	s.Require().Equal(deviceID, s.dbb.Identifier())
}

func jsonArgumentMatcher(expected map[string]interface{}) interface{} {
	return mock.MatchedBy(func(cmd string) bool {
		val := map[string]interface{}{}
		if err := json.Unmarshal([]byte(cmd), &val); err != nil {
			panic(err)
		}
		return reflect.DeepEqual(expected, val)
	})
}

func AssertPanicWithMessage(s *dbbTestSuite, expectedError string) {
	r := recover()
	if r == nil {
		s.T().Errorf("The code did not panic")
	}
	errorMsg := r.(*logrus.Entry)
	if errorMsg.Message != expectedError {
		s.T().Errorf("Did not fail with expected error message: \nWas:      '%v', \nExpected: '%v'.", errorMsg.Message, expectedError)
	}
}

func (s *dbbTestSuite) TestSetPassword() {
	s.Require().NoError(s.login())
	s.Require().Equal(StatusLoggedIn, s.dbb.Status())
}

func (s *dbbTestSuite) login() error {
	s.mockCommunication.On(
		"SendPlain",
		jsonArgumentMatcher(map[string]interface{}{"password": pin})).
		Return(
			map[string]interface{}{"password": "success"},
			nil,
		).
		Once()
	return s.dbb.SetPassword(pin)
}

func (s *dbbTestSuite) TestCreateWallet() {
	s.Require().NoError(s.login())
	const dummyWalletName = "walletname"
	s.mockCommunication.On(
		"SendEncrypt",
		mock.MatchedBy(func(msg string) bool {
			cmd := map[string]string{}
			if err := json.Unmarshal([]byte(msg), &cmd); err != nil {
				return false
			}
			name, ok := cmd["name"]
			return ok && name == "walletname"
		}),
		pin,
	).
		Return(map[string]interface{}{"name": dummyWalletName}, nil).
		Once()
	s.mockCommunication.On(
		"SendEncrypt",
		mock.MatchedBy(func(msg string) bool {
			cmd := map[string]map[string]string{}
			if err := json.Unmarshal([]byte(msg), &cmd); err != nil {
				return false
			}
			seed, ok := cmd["seed"]
			return ok && seed["source"] == "create" && seed["key"] == stretchedKey
		}),
		pin,
	).
		Return(map[string]interface{}{"seed": "success"}, nil).
		Once()
	s.mockCommunication.On(
		"SendEncrypt",
		mock.MatchedBy(func(msg string) bool {
			cmd := map[string]map[string]string{}
			if err := json.Unmarshal([]byte(msg), &cmd); err != nil {
				return false
			}
			backup, ok := cmd["backup"]
			return ok && strings.Contains(backup["check"], dummyWalletName) && backup["key"] == stretchedKey
		}),
		pin,
	).
		Return(map[string]interface{}{"backup": "success"}, nil).
		Once()
	s.Require().NoError(s.dbb.CreateWallet(dummyWalletName, recoveryPassword))
}

func (s *dbbTestSuite) TestDeviceClose() {
	s.Require().False(s.dbb.closed, "s.dbb.closed")
	s.Require().False(s.mockCommClosed, "s.mockCommClosed")
	s.dbb.Close()
	s.Require().True(s.dbb.closed, "s.dbb.closed")
	s.Require().True(s.mockCommClosed, "s.mockCommClosed")
}

func (s *dbbTestSuite) TestDeviceStatusEvent() {
	s.dbb.onStatusChanged() // just make sure it doesn't block or panic
	var fired, seen bool
	s.dbb.SetOnEvent(func(e event.Event, data interface{}) {
		fired = true
		if !seen && e == EventStatusChanged {
			seen = true
		}
	})
	s.dbb.onStatusChanged()
	s.Require().True(fired, "onEvent fired")
	s.Require().True(seen, "EventStatusChanged")
}

func TestNewDeviceReadsChannel(t *testing.T) {
	configDir := test.TstTempDir("dbb_device_test")
	defer func() { _ = os.RemoveAll(configDir) }()
	mobchan := relay.NewChannelWithRandomKey(socksproxy.NewSocksProxy(false, ""))
	if err := mobchan.StoreToConfigFile(configDir); err != nil {
		t.Fatal(err)
	}

	// TODO: Also run a relay server stub when available instead of hitting prod server; see TestPingMobile.
	comm := new(mocks.CommunicationInterface)
	comm.On("SendPlain", jsonArgumentMatcher(map[string]interface{}{"ping": ""})).
		Return(map[string]interface{}{"ping": ""}, nil)
	comm.On("Close")
	dbb, err := NewDevice("test-device-id", false, /* bootloader */
		lowestSupportedFirmwareVersion, configDir, comm, socksproxy.NewSocksProxy(false, ""))
	if err != nil {
		t.Fatal(err)
	}
	defer dbb.Close()

	if dbb.mobileChannel() == nil {
		t.Error("dbb.mobileChannel() returned nil")
	}
	if id := dbb.mobileChannel().ChannelID; id != mobchan.ChannelID {
		t.Errorf("channel ID = %q; want %q", id, mobchan.ChannelID)
	}
}

func (s *dbbTestSuite) TestListenForMobile() {
	// TODO: Need to be able to replace relay.DefaultServer URL in tests.
	s.T().Skip("implement once relay server URL can be replaced in testing")
}

func (s *dbbTestSuite) TestPingMobile() {
	// TODO: Need to be able to replace relay.DefaultServer URL in tests.
	s.T().Skip("implement once relay server URL can be replaced in testing")
}

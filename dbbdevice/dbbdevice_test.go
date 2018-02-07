package dbbdevice_test

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/shiftdevices/godbb/dbbdevice"
	"github.com/shiftdevices/godbb/dbbdevice/mocks"
	"github.com/shiftdevices/godbb/util/semver"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

var (
	firmwareVersion = semver.NewSemVer(2, 2, 3)
)

const (
	deviceID     = "device id"
	password     = "this is a secret"
	stretchedKey = "b2de5eebf2a922bda5079020ad2369a6545236145466c37ec7969600bf5242889f0713484782d15865de398dfc77475d6d23fb34aa167ebb0331408b37794ee8"
)

type dbbTestSuite struct {
	suite.Suite
	mockCommunication *mocks.CommunicationInterface
	dbb               *dbbdevice.DBBDevice
}

func (s *dbbTestSuite) SetupTest() {
	s.mockCommunication = new(mocks.CommunicationInterface)
	s.mockCommunication.On("SendPlain", jsonArgumentMatcher(map[string]interface{}{"ping": ""})).
		Return(map[string]interface{}{"ping": ""}, nil).
		Once()
	dbb, err := dbbdevice.NewDBBDevice(deviceID, firmwareVersion, s.mockCommunication)
	require.NoError(s.T(), err)
	s.dbb = dbb
}

func TestDBBTestSuite(t *testing.T) {
	suite.Run(t, &dbbTestSuite{})
}

func (s *dbbTestSuite) TestNewDBBDevice() {
	require.Equal(s.T(), dbbdevice.StatusUninitialized, s.dbb.Status())
}

func (s *dbbTestSuite) TestDeviceID() {
	require.Equal(s.T(), deviceID, s.dbb.DeviceID())
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

func (s *dbbTestSuite) TestSetPassword() {
	require.NoError(s.T(), s.login())
	require.Equal(s.T(), dbbdevice.StatusLoggedIn, s.dbb.Status())
}

func (s *dbbTestSuite) login() error {
	s.mockCommunication.On(
		"SendPlain",
		jsonArgumentMatcher(map[string]interface{}{"password": password})).
		Return(
			map[string]interface{}{"password": "success"},
			nil,
		).
		Once()
	return s.dbb.SetPassword(password)
}

func (s *dbbTestSuite) TestCreateWallet() {
	require.NoError(s.T(), s.login())
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
		password,
	).
		Return(map[string]interface{}{"seed": "success"}, nil).
		Once()
	require.NoError(s.T(), s.dbb.CreateWallet("walletname"))
}

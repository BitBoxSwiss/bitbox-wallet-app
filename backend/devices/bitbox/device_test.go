package bitbox_test

import (
	"encoding/hex"
	"encoding/json"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/shiftdevices/godbb/backend/devices/bitbox"
	"github.com/shiftdevices/godbb/backend/devices/bitbox/mocks"
	"github.com/shiftdevices/godbb/util/jsonp"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/semver"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

var (
	firmwareVersion = semver.NewSemVer(2, 2, 3)
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
	dbb               *bitbox.Device

	log *logrus.Entry
}

func (s *dbbTestSuite) SetupTest() {
	s.log = logging.Log.WithGroup("bitbox_test")
	s.mockCommunication = new(mocks.CommunicationInterface)
	s.mockCommunication.On("SendPlain", jsonArgumentMatcher(map[string]interface{}{"ping": ""})).
		Return(map[string]interface{}{"ping": ""}, nil).
		Once()
	dbb, err := bitbox.NewDevice(deviceID, "serial", false, firmwareVersion, s.mockCommunication)
	dbb.SetPasswordPolicy(true)
	require.NoError(s.T(), err)
	s.dbb = dbb
}

func TestDBBTestSuite(t *testing.T) {
	suite.Run(t, &dbbTestSuite{})
}

func (s *dbbTestSuite) TestNewDBBDevice() {
	require.Equal(s.T(), bitbox.StatusUninitialized, s.dbb.Status())
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
	require.NoError(s.T(), s.login())
	require.Equal(s.T(), bitbox.StatusLoggedIn, s.dbb.Status())
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
			return ok && strings.Contains(backup["check"], "walletname") && backup["key"] == stretchedKey
		}),
		pin,
	).
		Return(map[string]interface{}{"backup": "success"}, nil).
		Once()
	require.NoError(s.T(), s.dbb.CreateWallet("walletname", recoveryPassword))
}

func (s *dbbTestSuite) TestSignZero() {
	require.NoError(s.T(), s.login())

	const expectedError = "Non-empty list of signature hashes and keypaths expected"

	// the following function is called upon panic()
	defer AssertPanicWithMessage(s, expectedError)

	signatureHash := []byte{0, 0, 0, 0, 0}
	keyPath := "m/44'/0'/1'/0"
	element := map[string]interface{}{"hash": hex.EncodeToString(signatureHash), "keypath": keyPath}
	data := map[string]interface{}{"data": []interface{}{element}}
	sign := map[string]interface{}{"sign": data}

	responseSignature := make([]byte, 64)
	s.mockDeviceInfo()
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(sign),
		pin,
	).
		Return(map[string]interface{}{"sign": []interface{}{map[string]interface{}{"sig": hex.EncodeToString(responseSignature)}}}, nil).
		Twice()
	// Return value can be ignored as the function panics.
	_, _ = s.dbb.Sign(nil, [][]byte{}, []string{})
}

func (s *dbbTestSuite) TestSignSingle() {
	require.NoError(s.T(), s.login())
	signatureHash := []byte{0, 0, 0, 0, 0}
	keyPath := "m/44'/0'/1'/0"
	element := map[string]interface{}{"hash": hex.EncodeToString(signatureHash), "keypath": keyPath}
	data := map[string]interface{}{"data": []interface{}{element}}
	sign := map[string]interface{}{"sign": data}

	responseSignature := make([]byte, 64)
	s.mockDeviceInfo()
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(sign),
		pin,
	).
		Return(nil, nil).
		Once()
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(map[string]interface{}{"sign": ""}),
		pin,
	).
		Return(map[string]interface{}{"sign": []interface{}{map[string]interface{}{"sig": hex.EncodeToString(responseSignature)}}}, nil).
		Once()

	signatures, err := s.dbb.Sign(nil, [][]byte{signatureHash}, []string{keyPath})
	require.NoError(s.T(), err)
	require.Len(s.T(), signatures, 1)
}

func (s *dbbTestSuite) mockDeviceInfo() {
	deviceInfoMap := map[string]interface{}{}
	_ = json.Unmarshal(jsonp.MustMarshal(&bitbox.DeviceInfo{}), &deviceInfoMap)
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(map[string]interface{}{"device": "info"}),
		pin,
	).Return(map[string]interface{}{"device": deviceInfoMap}, nil).Once()
}

func (s *dbbTestSuite) TestSignFifteen() {
	require.NoError(s.T(), s.login())

	dataSlice := []interface{}{}
	keypaths := []string{}
	signatureHashes := [][]byte{}
	for i := 0; i < 15; i++ {
		signatureHash := []byte{0, 0, 0, 0, byte(i)}
		keyPath := "m/44'/0'/1'/" + strconv.Itoa(i)
		signatureHashes = append(signatureHashes, signatureHash)
		keypaths = append(keypaths, keyPath)
		element := map[string]interface{}{"hash": hex.EncodeToString(signatureHash), "keypath": keyPath}
		dataSlice = append(dataSlice, element)
	}
	data := map[string]interface{}{"data": dataSlice}
	sign := map[string]interface{}{"sign": data}

	responseSignatures := []interface{}{}
	for i := 0; i < 15; i++ {
		responseSignature := make([]byte, 64)
		responseSignatures = append(responseSignatures, map[string]interface{}{"sig": hex.EncodeToString(responseSignature)})
	}
	s.mockDeviceInfo()
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(sign),
		pin,
	).
		Return(nil, nil).
		Once()
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(map[string]interface{}{"sign": ""}),
		pin,
	).
		Return(map[string]interface{}{"sign": responseSignatures}, nil).
		Once()
	signatures, err := s.dbb.Sign(nil, signatureHashes, keypaths)
	require.NoError(s.T(), err)
	require.Len(s.T(), signatures, 15)
}

func (s *dbbTestSuite) TestSignSixteen() {
	require.NoError(s.T(), s.login())

	dataSlice := []interface{}{}
	keypaths := []string{}
	signatureHashes := [][]byte{}
	for i := 0; i < 16; i++ {
		signatureHash := []byte{0, 0, 0, 0, byte(i)}
		keyPath := "m/44'/0'/1'/" + strconv.Itoa(i)
		signatureHashes = append(signatureHashes, signatureHash)
		keypaths = append(keypaths, keyPath)
		element := map[string]interface{}{"hash": hex.EncodeToString(signatureHash), "keypath": keyPath}
		dataSlice = append(dataSlice, element)
	}
	data1 := map[string]interface{}{"data": dataSlice[:15]}
	sign1 := map[string]interface{}{"sign": data1}
	data2 := map[string]interface{}{"data": dataSlice[15:]}
	sign2 := map[string]interface{}{"sign": data2}

	responseSignatures1 := []interface{}{}
	for i := 0; i < 15; i++ {
		responseSignature := make([]byte, 64)
		responseSignature[63] = byte(i)
		responseSignatures1 = append(responseSignatures1, map[string]interface{}{"sig": hex.EncodeToString(responseSignature)})
	}
	responseSignature2 := make([]byte, 64)
	responseSignature2[63] = byte(15)
	responseSignatures2 := []interface{}{map[string]interface{}{"sig": hex.EncodeToString(responseSignature2)}}
	s.mockDeviceInfo()

	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(sign1),
		pin,
	).
		Return(nil, nil).
		Once()
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(map[string]interface{}{"sign": ""}),
		pin,
	).
		Return(map[string]interface{}{"sign": responseSignatures1}, nil).
		Once()

	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(sign2),
		pin,
	).
		Return(nil, nil).
		Once()
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(map[string]interface{}{"sign": ""}),
		pin,
	).
		Return(map[string]interface{}{"sign": responseSignatures2}, nil).
		Once()

	signatures, err := s.dbb.Sign(nil, signatureHashes, keypaths)
	require.NoError(s.T(), err)
	require.Len(s.T(), signatures, 16)
}

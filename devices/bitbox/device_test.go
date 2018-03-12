package bitbox_test

import (
	"encoding/hex"
	"encoding/json"
	"reflect"
	"strconv"
	"testing"

	"github.com/shiftdevices/godbb/devices/bitbox"
	"github.com/shiftdevices/godbb/devices/bitbox/mocks"
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
	dbb               *bitbox.Device
}

func (s *dbbTestSuite) SetupTest() {
	s.mockCommunication = new(mocks.CommunicationInterface)
	s.mockCommunication.On("SendPlain", jsonArgumentMatcher(map[string]interface{}{"ping": ""})).
		Return(map[string]interface{}{"ping": ""}, nil).
		Once()
	dbb, err := bitbox.NewDevice(deviceID, firmwareVersion, s.mockCommunication)
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
	errorMsg := r.(string)
	if errorMsg != expectedError {
		s.T().Errorf("Did not fail with expected error message: \nWas:      '%v', \nExpected: '%v'.", errorMsg, expectedError)
	}
}

func (s *dbbTestSuite) TestSetPassword() {
	require.NoError(s.T(), s.login())
	require.Equal(s.T(), bitbox.StatusLoggedIn, s.dbb.Status())
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

func (s *dbbTestSuite) TestSignZero() {
	require.NoError(s.T(), s.login())

	const expectedError = "non-empty list of signature hashes and keypaths expected"

	// the following function is called upon panic()
	defer AssertPanicWithMessage(s, expectedError)

	signatureHash := []byte{0, 0, 0, 0, 0}
	keyPath := "m/44'/0'/1'/0"
	element := map[string]interface{}{"hash": hex.EncodeToString(signatureHash), "keypath": keyPath}
	data := map[string]interface{}{"data": []interface{}{element}}
	sign := map[string]interface{}{"sign": data}

	responseSignature := make([]byte, 64)
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(sign),
		password,
	).
		Return(map[string]interface{}{"sign": []interface{}{map[string]interface{}{"sig": hex.EncodeToString(responseSignature)}}}, nil).
		Twice()
	// Return value can be ignored as the function panics.
	_, _ = s.dbb.Sign([][]byte{}, []string{})

}

func (s *dbbTestSuite) TestSignSingle() {
	require.NoError(s.T(), s.login())
	signatureHash := []byte{0, 0, 0, 0, 0}
	keyPath := "m/44'/0'/1'/0"
	element := map[string]interface{}{"hash": hex.EncodeToString(signatureHash), "keypath": keyPath}
	data := map[string]interface{}{"data": []interface{}{element}}
	sign := map[string]interface{}{"sign": data}

	responseSignature := make([]byte, 64)
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(sign),
		password,
	).
		Return(map[string]interface{}{"sign": []interface{}{map[string]interface{}{"sig": hex.EncodeToString(responseSignature)}}}, nil).
		Twice()
	signatures, err := s.dbb.Sign([][]byte{signatureHash}, []string{keyPath})
	require.NoError(s.T(), err)
	require.Len(s.T(), signatures, 1)
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
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(sign),
		password,
	).
		Return(map[string]interface{}{"sign": responseSignatures}, nil).
		Twice()
	signatures, err := s.dbb.Sign(signatureHashes, keypaths)
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
	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(sign1),
		password,
	).
		Return(map[string]interface{}{"sign": responseSignatures1}, nil).
		Twice()

	s.mockCommunication.On(
		"SendEncrypt",
		jsonArgumentMatcher(sign2),
		password,
	).
		Return(map[string]interface{}{"sign": responseSignatures2}, nil).
		Twice()
	signatures, err := s.dbb.Sign(signatureHashes, keypaths)
	require.NoError(s.T(), err)
	require.Len(s.T(), signatures, 16)
}

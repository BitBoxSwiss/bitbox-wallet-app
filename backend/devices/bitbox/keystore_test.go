package bitbox

import (
	"os"
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestKeystoreRootFingerprint(t *testing.T) {
	const testPin = "1234"
	pingReq := map[string]interface{}{"ping": ""}
	pingRes := map[string]interface{}{"ping": "password"}
	xpubReq := map[string]interface{}{"xpub": "m/84'"}
	xpubRes := map[string]interface{}{
		// Test vector 1, chain m/0' from https://en.bitcoin.it/wiki/BIP_0032#Test_Vectors.
		"xpub": "xpub68Gmy5EdvgibQVfPdqkBBCHxA5htiqg55crXYuXoQRKfDBFA1WEjWgP6LHhwBZeNK1VTsfTFUHCdrfp1bgwQ9xv5ski8PX9rL2dZXvgGDnw",
	}
	comm := new(mocks.CommunicationInterface)
	comm.On("SendPlain", jsonArgumentMatcher(pingReq)).Return(pingRes, nil)
	comm.On("SendEncrypt", jsonArgumentMatcher(xpubReq), testPin).Return(xpubRes, nil)
	confdir := test.TstTempDir("dbb_device_test")
	defer os.RemoveAll(confdir)
	dbb, err := NewDevice(
		"testdev",
		false, // in bootloader mode
		lowestSupportedFirmwareVersion,
		confdir,
		comm,
		socksproxy.NewSocksProxy(false, ""),
	)
	require.NoError(t, err, "NewDevice")
	require.NoError(t, dbb.Init(true), "dbb.Init")
	dbb.pin = testPin

	k := &keystore{dbb: dbb}
	finger, err := k.RootFingerprint()
	require.NoError(t, err, "k.RootFingerprint returned non-nil error")
	assert.Equal(t, []byte("\x34\x42\x19\x3e"), finger, "k.RootFingerprint")
	assert.Equal(t, finger, k.rootFinger, "k.rootFinger (cache)")
}

func TestKeystoreRootFingerprintCache(t *testing.T) {
	k := &keystore{rootFinger: []byte{1, 2, 3, 4}}
	finger, err := k.RootFingerprint()
	require.NoError(t, err, "k.RootFingerprint returned non-nil error")
	assert.Equal(t, []byte{1, 2, 3, 4}, finger, "k.RootFingerprint")
}

package pairing_test

import (
	"encoding/base64"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/shiftdevices/godbb/devices/bitbox/pairing"
)

const (
	// Use your own values here: Pair your BitBox first with the old desktop app and then retrieve
	// the encryption key and channel ID from the configuration file (on macOS, run the following
	// command: 'cat ~/Library/Application\ Support/DBB/config.dat') and the TFA test string and
	// xpub echo with the Electron demo app from https://github.com/digitalbitbox/ElectronDemo.
	encryptionKey = "8whIWgqSR/vWuC0agi3wG90MhXFH6wFtDLwvLwzVs2I="
	channelID     = "21M5jzWwx8hPLYQaMF864fPnzX7GsqaHrre"
	tfaTestString = "5hcaTvjdIm6eb9KZv7wRuPKZQWcRSRsPwJ1rptJJApAes6mVHZ/+RTG6FkA3d3FS"
	xpubEcho      = "Dumx+aTBaR3NHqf4XxT5b7VtstfsJ9XExu5b8ZovZud+dsVmdtULr5AiOp2RkAU11d9TopwSDnT6lz8itr2T66EWixCBu/WkHfRpehVcU+CY5hhr9zfEoxnBrddUg+0zhyTlbq5FryaqCgZT+qnMBvjKN7Zsc3FvKZ0yS5yvus0="
)

func TestChannel(t *testing.T) {
	encryptionKey, err := base64.StdEncoding.DecodeString(encryptionKey)
	if err != nil {
		panic("Cannot decode the testing encryption key!")
	}

	channel := pairing.NewChannel(channelID, encryptionKey)

	if false { // Activate once you have configured the constants above and opened the mobile app.
		assert.NoError(t, channel.SendPing())
		received, err := channel.WaitForPong()
		assert.True(t, received)
		assert.NoError(t, err)

		assert.NoError(t, channel.SendPairingTest(tfaTestString))
		time.Sleep(5 * time.Second)
		assert.NoError(t, channel.SendXpubEcho(xpubEcho))
	}
}

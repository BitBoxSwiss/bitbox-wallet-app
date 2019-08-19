package types

import (
	"bytes"
	"errors"

	"github.com/status-im/keycard-go/apdu"
	"github.com/status-im/keycard-go/derivationpath"
)

const hardenedStart = 0x80000000 // 2^31

var ErrApplicationStatusTemplateNotFound = errors.New("application status template not found")

type ApplicationStatus struct {
	PinRetryCount  int
	PUKRetryCount  int
	KeyInitialized bool
	Path           string
}

func ParseApplicationStatus(data []byte) (*ApplicationStatus, error) {
	tpl, err := apdu.FindTag(data, apdu.Tag{TagApplicationStatusTemplate})
	if err != nil {
		return parseKeyPathStatus(data)
	}

	appStatus := &ApplicationStatus{}

	if pinRetryCount, err := apdu.FindTag(tpl, apdu.Tag{0x02}); err == nil && len(pinRetryCount) == 1 {
		appStatus.PinRetryCount = int(pinRetryCount[0])
	}

	if pukRetryCount, err := apdu.FindTagN(tpl, 1, apdu.Tag{0x02}); err == nil && len(pukRetryCount) == 1 {
		appStatus.PUKRetryCount = int(pukRetryCount[0])
	}

	if keyInitialized, err := apdu.FindTag(tpl, apdu.Tag{0x01}); err == nil {
		if bytes.Equal(keyInitialized, []byte{0xFF}) {
			appStatus.KeyInitialized = true
		}
	}

	return appStatus, nil
}

func parseKeyPathStatus(data []byte) (*ApplicationStatus, error) {
	appStatus := &ApplicationStatus{}

	path, err := derivationpath.EncodeFromBytes(data)
	if err != nil {
		return nil, err
	}

	appStatus.Path = path

	return appStatus, nil
}

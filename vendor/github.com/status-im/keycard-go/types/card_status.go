package types

import (
	"fmt"

	"github.com/status-im/keycard-go/apdu"
)

type lifeCycle byte

var (
	TagGetStatusTemplate       = apdu.Tag{0xE3}
	TagGetStatusLifeCycleState = apdu.Tag{0x9F, 0x70}
)

const (
	LifeCycleOpReady     lifeCycle = 0x01
	LifeCycleInitialized           = 0x07
	LifeCycleSecured               = 0x0F
	LifeCycleCardLocked            = 0x7F
	LifeCycleTerminated            = 0xFF
)

func (lc lifeCycle) String() string {
	switch lc {
	case LifeCycleOpReady:
		return "OP_READY"
	case LifeCycleInitialized:
		return "INITIALIZED"
	case LifeCycleSecured:
		return "SECURED"
	case LifeCycleCardLocked:
		return "CARD_LOCKED"
	case LifeCycleTerminated:
		return "TERMINATED"
	default:
		return "UNKNOWN"
	}
}

type ErrInvalidLifeCycleValue struct {
	lc []byte
}

func (e *ErrInvalidLifeCycleValue) Error() string {
	return fmt.Sprintf("life cycle value must be 1 byte. got %d bytes: %x", len(e.lc), e.lc)
}

type CardStatus struct {
	lc lifeCycle
}

func (cs *CardStatus) LifeCycle() string {
	return cs.lc.String()
}

func ParseCardStatus(data []byte) (*CardStatus, error) {
	tpl, err := apdu.FindTag(data, TagGetStatusTemplate)
	if err != nil {
		return nil, err
	}

	lc, err := apdu.FindTag(tpl, TagGetStatusLifeCycleState)
	if err != nil {
		return nil, err
	}

	if len(lc) != 1 {
		return nil, &ErrInvalidLifeCycleValue{lc}
	}

	return &CardStatus{lifeCycle(lc[0])}, nil
}

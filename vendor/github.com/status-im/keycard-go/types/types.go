package types

import "github.com/status-im/keycard-go/apdu"

// Channel is an interface with a Send method to send apdu commands and receive apdu responses.
type Channel interface {
	Send(*apdu.Command) (*apdu.Response, error)
}

type PairingInfo struct {
	Key   []byte
	Index int
}
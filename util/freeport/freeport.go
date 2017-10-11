package freeport

import (
	"net"

	"github.com/shiftdevices/godbb/util/errp"
)

func FreePort() (int, error) {
	listener, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return 0, errp.WithStack(err)
	}
	defer listener.Close()
	return listener.Addr().(*net.TCPAddr).Port, nil
}

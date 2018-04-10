package freeport

import (
	"net"

	"github.com/shiftdevices/godbb/util/errp"
	"github.com/sirupsen/logrus"
)

// FreePort returns a random unused port.
func FreePort(log *logrus.Entry) (port int, err error) {
	var listener net.Listener
	listener, err = net.Listen("tcp", "localhost:0")
	if err != nil {
		return 0, errp.WithStack(err)
	}
	defer func() {
		err = listener.Close()
	}()
	port = listener.Addr().(*net.TCPAddr).Port
	log.WithField("port", port).Debug("Free port")
	return
}

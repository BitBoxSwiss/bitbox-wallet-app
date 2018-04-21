package electrum

import (
	"crypto/tls"
	"crypto/x509"
	"io"
	"net"

	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonrpc"
	"github.com/sirupsen/logrus"
)

// ConnectionError indicates an error when establishing a network connection.
type ConnectionError error

func newTCPConnection(address string) (net.Conn, error) {
	conn, err := net.Dial("tcp", address)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return conn, nil
}

func newTLSConnection(address string) (*tls.Conn, error) {
	caCertPool := x509.NewCertPool()
	// Load CA cert
	caCert, err := Asset("../../../config/certificates/electrumx/dev/ca.cert.pem")
	if err != nil {
		return nil, errp.WithStack(err)
	}
	if ok := caCertPool.AppendCertsFromPEM(caCert); !ok {
		return nil, errp.WithStack(errp.New("Failed to append CA cert as trusted cert"))
	}
	conn, err := tls.Dial("tcp", address, &tls.Config{
		RootCAs: caCertPool,
	})
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return conn, nil
}

func maybeConnectionError(err error) error {
	if _, ok := errp.Cause(err).(jsonrpc.SocketError); ok {
		return ConnectionError(err)
	}
	return err
}

// NewElectrumClient connects to an Electrum server and returns a ElectrumClient instance to
// communicate with it.
func NewElectrumClient(server string, tls bool, failureCallback func(error), log *logrus.Entry) (*client.ElectrumClient, error) {
	log = log.WithFields(logrus.Fields{"group": "electrum", "server-type": "electrumx", "server": server, "tls": tls})
	log.Debug("Connecting to Electrum server")
	var conn io.ReadWriteCloser
	if tls {
		var err error
		conn, err = newTLSConnection(server)
		if err != nil {
			return nil, ConnectionError(err)
		}
	} else {
		var err error
		conn, err = newTCPConnection(server)
		if err != nil {
			return nil, ConnectionError(err)
		}
	}
	wrappedFailureCallback := func(err error) {
		if err != nil {
			failureCallback(maybeConnectionError(err))
		}
	}
	c, err := client.NewElectrumClient(jsonrpc.NewRPCClient(conn, wrappedFailureCallback, log), log)
	if err != nil {
		return nil, maybeConnectionError(err)
	}
	return c, nil
}

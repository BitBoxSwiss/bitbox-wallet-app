package electrum

import (
	"crypto/tls"
	"crypto/x509"
	"io"
	"net"

	"github.com/shiftdevices/godbb/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonrpc"
	"github.com/sirupsen/logrus"
)

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

// NewElectrumClient connects to an Electrum server and returns a ElectrumClient instance to
// communicate with it.
func NewElectrumClient(server string, tls bool, logEntry *logrus.Entry) (*client.ElectrumClient, error) {
	logEntry = logEntry.WithFields(logrus.Fields{"group": "electrum", "server-type": "electrumx", "server": server, "tls": tls})
	logEntry.Debug("Connecting to Electrum server")
	var conn io.ReadWriteCloser
	if tls {
		var err error
		conn, err = newTLSConnection(server)
		if err != nil {
			return nil, errp.WithMessage(err, "Failed to establish TLS connection")
		}
	} else {
		var err error
		conn, err = newTCPConnection(server)
		if err != nil {
			return nil, errp.WithMessage(err, "Failed to establish TCP connection")
		}
	}
	rpcClient, err := jsonrpc.NewRPCClient(conn)
	if err != nil {
		return nil, errp.Wrap(err, "Failed to establish RPC connection")
	}
	return client.NewElectrumClient(rpcClient, logEntry)
}

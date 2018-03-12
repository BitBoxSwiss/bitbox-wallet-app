package electrum

import (
	"crypto/tls"
	"crypto/x509"
	"io"
	"log"
	"net"

	"github.com/shiftdevices/godbb/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonrpc"
)

func newTCPConnection(address string) (net.Conn, error) {
	conn, err := net.Dial("tcp", address)
	return conn, errp.WithStack(err)
}

func newTLSConnection(address string) (*tls.Conn, error) {
	caCertPool := x509.NewCertPool()
	// Load CA cert
	caCert, err := Asset("../../../config/certificates/electrumx/dev/ca.cert.pem")
	if err != nil {
		log.Fatal(err)
	}
	caCertPool.AppendCertsFromPEM(caCert)
	conn, err := tls.Dial("tcp", address, &tls.Config{
		RootCAs: caCertPool,
	})
	return conn, errp.WithStack(err)
}

// NewElectrumClient connects to an Electrum server and returns a ElectrumClient instance to
// communicate with it.
func NewElectrumClient(server string, tls bool) (*client.ElectrumClient, error) {
	var conn io.ReadWriteCloser
	if tls {
		var err error
		conn, err = newTLSConnection(server)
		if err != nil {
			return nil, err
		}
	} else {
		var err error
		conn, err = newTCPConnection(server)
		if err != nil {
			return nil, err
		}
	}
	rpcClient, err := jsonrpc.NewRPCClient(conn)
	if err != nil {
		return nil, err
	}
	return client.NewElectrumClient(rpcClient)
}

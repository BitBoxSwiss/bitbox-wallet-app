package electrum

import (
	"crypto/tls"
	"crypto/x509"
	"io"
	"net"

	"github.com/shiftdevices/godbb/backend/coins/btc/blockchain"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonrpc"
	"github.com/shiftdevices/godbb/util/rpc"
	"github.com/sirupsen/logrus"
)

// ConnectionError indicates an error when establishing a network connection.
type ConnectionError error

// Electrum holds information about the electrum backend
type Electrum struct {
	log        *logrus.Entry
	serverInfo *rpc.ServerInfo
}

// ServerInfo returns the server info for this backend.
func (electrum *Electrum) ServerInfo() *rpc.ServerInfo {
	return electrum.serverInfo
}

// EstablishConnection connects to a backend and returns an rpc client
// or an error if the connection could not be established.
func (electrum *Electrum) EstablishConnection() (io.ReadWriteCloser, error) {
	var conn io.ReadWriteCloser
	if electrum.serverInfo.TLS {
		var caCert []byte
		var err error
		if electrum.serverInfo.DevCaCert {
			caCert, err = Asset("../../../../config/certificates/electrumx/dev/ca.cert.pem")
		} else {
			caCert, err = Asset("../../../../config/certificates/electrumx/prod/ca.cert.pem")
		}
		if err != nil {
			panic(err)
		}
		conn, err = newTLSConnection(electrum.serverInfo.Server, caCert)
		if err != nil {
			return nil, ConnectionError(err)
		}
	} else {
		var err error
		conn, err = newTCPConnection(electrum.serverInfo.Server)
		if err != nil {
			return nil, ConnectionError(err)
		}
	}
	return conn, nil
}

func newTCPConnection(address string) (net.Conn, error) {
	conn, err := net.Dial("tcp", address)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return conn, nil
}

func newTLSConnection(address string, caCert []byte) (*tls.Conn, error) {
	caCertPool := x509.NewCertPool()
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

// NewElectrumConnection connects to an Electrum server and returns a ElectrumClient instance to
// communicate with it.
func NewElectrumConnection(servers []*rpc.ServerInfo, log *logrus.Entry) blockchain.Interface {
	var serverList string
	for _, serverInfo := range servers {
		if serverList != "" {
			serverList += ", "
		}
		serverList += serverInfo.Server
	}
	log = log.WithFields(logrus.Fields{"group": "electrum", "server-type": "electrumx", "servers": serverList})
	log.Debug("Connecting to Electrum server")

	backends := []rpc.Backend{}
	for _, serverInfo := range servers {
		backends = append(backends, &Electrum{log, serverInfo})
	}
	jsonrpcClient := jsonrpc.NewRPCClient(backends, log)
	return client.NewElectrumClient(jsonrpcClient, log)
}

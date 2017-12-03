package electrum

import (
	"crypto/tls"
	"io"
	"log"
	"net"
	"os"
	"strings"

	"github.com/shiftdevices/godbb/electrum/client"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonrpc"
)

// Server is a temporary default bitcoin electrum server.
var Server = "E-X.not.fyi:50002"

// TestServer is a temporary default bitcoin testnet electrum server.
var TestServer = "testnetnode.arihanc.com:51002"

//var testServer = "testnet.hsmiths.com:53012"

// const testServer = "172.17.0.1:51001"

// var testServer = "localhost:51001"

func init() {
	// Temporary help for development to be able to connect to ElectrumX on the host from a Docker
	// container.
	host := os.Getenv("GODBB_HOST")
	if host != "" {
		TestServer = strings.Replace(TestServer, "localhost", host, 1)
		log.Printf("setting electrum host to %s", TestServer)
	}
}

func newTCPConnection(address string) (net.Conn, error) {
	conn, err := net.Dial("tcp", address)
	return conn, errp.WithStack(err)
}

func newTLSConnection(address string) (*tls.Conn, error) {
	conn, err := tls.Dial("tcp", address, &tls.Config{
		// TODO: connect securely
		InsecureSkipVerify: true,
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

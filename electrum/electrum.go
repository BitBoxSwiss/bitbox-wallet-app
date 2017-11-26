package electrum

import (
	"crypto/tls"
	"log"
	"net"
	"os"
	"strings"

	"github.com/shiftdevices/godbb/electrum/client"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/jsonrpc"
)

// const server = "E-X.not.fyi:50002"

// const testServer = "testnetnode.arihanc.com:51002"

//const testServer = "testnet.hsmiths.com:53012"

// const testServer = "172.17.0.1:51001"

var testServer = "localhost:51001"

func init() {
	// Temporary help for development to be able to connect to ElectrumX on the host from a Docker
	// container.
	host := os.Getenv("GODBB_HOST")
	if host != "" {
		testServer = strings.Replace(testServer, "localhost", host, 1)
		log.Printf("setting electrum host to %s", testServer)
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

func NewElectrumClient() (*client.ElectrumClient, error) {
	tlsConn, err := newTCPConnection(testServer)
	if err != nil {
		return nil, err
	}
	rpcClient, err := jsonrpc.NewRPCClient(tlsConn)
	if err != nil {
		return nil, err
	}
	return client.NewElectrumClient(rpcClient)
}

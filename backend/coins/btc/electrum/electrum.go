// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package electrum

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"io"
	"net"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/electrum/client"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonrpc"
	"github.com/digitalbitbox/bitbox-wallet-app/util/rpc"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/sirupsen/logrus"
)

// ConnectionError indicates an error when establishing a network connection.
type ConnectionError error

// Electrum holds information about the electrum backend
type Electrum struct {
	log        *logrus.Entry
	serverInfo *rpc.ServerInfo
	socksProxy socksproxy.SocksProxy
}

// NewElectrum creates a new Electrum instance.
func NewElectrum(log *logrus.Entry, serverInfo *rpc.ServerInfo, socksProxy socksproxy.SocksProxy) *Electrum {
	return &Electrum{log, serverInfo, socksProxy}
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
		var err error
		conn, err = newTLSConnection(electrum.serverInfo.Server, electrum.serverInfo.PEMCert, electrum.socksProxy)
		if err != nil {
			return nil, ConnectionError(err)
		}
	} else {
		var err error
		conn, err = newTCPConnection(electrum.serverInfo.Server, electrum.socksProxy)
		if err != nil {
			return nil, ConnectionError(err)
		}
	}
	return conn, nil
}

func newTLSConnection(address string, rootCert string, socksProxy socksproxy.SocksProxy) (*tls.Conn, error) {
	caCertPool := x509.NewCertPool()
	if ok := caCertPool.AppendCertsFromPEM([]byte(rootCert)); !ok {
		return nil, errp.New("Failed to append CA cert as trusted cert")
	}
	dialer, err := socksProxy.GetTCPProxyDialer()
	if err != nil {
		return nil, errp.WithStack(err)
	}
	conn, err := dialer.Dial("tcp", address)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	tlsConn := tls.Client(conn, &tls.Config{
		RootCAs:            caCertPool,
		InsecureSkipVerify: true, // Not actually skipping, we check the cert in VerifyPeerCertificate
		VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
			// Code copy/pasted and adapted from
			// https://github.com/golang/go/blob/81555cb4f3521b53f9de4ce15f64b77cc9df61b9/src/crypto/tls/handshake_client.go#L327-L344, but adapted to skip the hostname verification.
			// See https://github.com/golang/go/issues/21971#issuecomment-412836078.

			// If this is the first handshake on a connection, process and
			// (optionally) verify the server's certificates.
			certs := make([]*x509.Certificate, len(rawCerts))
			for i, asn1Data := range rawCerts {
				cert, err := x509.ParseCertificate(asn1Data)
				if err != nil {
					return errp.New("bitbox/electrum: failed to parse certificate from server: " + err.Error())
				}
				certs[i] = cert
			}

			opts := x509.VerifyOptions{
				Roots:         caCertPool,
				CurrentTime:   time.Now(),
				DNSName:       "", // <- skip hostname verification
				Intermediates: x509.NewCertPool(),
			}

			for i, cert := range certs {
				if i == 0 {
					continue
				}
				opts.Intermediates.AddCert(cert)
			}
			_, err := certs[0].Verify(opts)
			return err
		},
	})
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return tlsConn, nil
}

func newTCPConnection(address string, socksProxy socksproxy.SocksProxy) (net.Conn, error) {
	dialer, err := socksProxy.GetTCPProxyDialer()
	if err != nil {
		return nil, errp.WithStack(err)
	}
	conn, err := dialer.Dial("tcp", address)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return conn, nil
}

// NewElectrumConnection connects to an Electrum server and returns a ElectrumClient instance to
// communicate with it.
func NewElectrumConnection(servers []*rpc.ServerInfo, log *logrus.Entry, socksProxy socksproxy.SocksProxy) blockchain.Interface {
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
		backends = append(backends, &Electrum{log, serverInfo, socksProxy})
	}
	jsonrpcClient := jsonrpc.NewRPCClient(backends, nil, log)
	return client.NewElectrumClient(jsonrpcClient, log)
}

// DownloadCert downloads the first element of the remote certificate chain.
func DownloadCert(server string, socksProxy socksproxy.SocksProxy) (string, error) {
	var pemCert []byte
	dialer, err := socksProxy.GetTCPProxyDialer()
	if err != nil {
		return "", errp.WithStack(err)
	}
	conn, err := dialer.Dial("tcp", server)
	if err != nil {
		return "", errp.WithStack(err)
	}

	tlsConn := tls.Client(conn, &tls.Config{
		VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
			if len(rawCerts) == 0 {
				return errp.New("no remote certs")
			}

			certificatePEM := &pem.Block{Type: "CERTIFICATE", Bytes: rawCerts[0]}
			certificatePEMBytes := &bytes.Buffer{}
			if err := pem.Encode(certificatePEMBytes, certificatePEM); err != nil {
				panic(err)
			}
			pemCert = certificatePEMBytes.Bytes()
			return nil
		},
		InsecureSkipVerify: true,
	})
	err = tlsConn.Handshake()
	if err != nil {
		return "", errp.WithStack(err)
	}
	_ = tlsConn.Close()
	return string(pemCert), nil
}

// CheckElectrumServer checks if a tls connection can be established with the electrum server, and
// whether the server is an electrum server.
func CheckElectrumServer(server string, pemCert string, log *logrus.Entry, socksProxy socksproxy.SocksProxy) error {
	backends := []rpc.Backend{
		NewElectrum(log, &rpc.ServerInfo{Server: server, TLS: true, PEMCert: pemCert}, socksProxy),
	}
	conn, err := backends[0].EstablishConnection()
	if err != nil {
		return err
	}
	_ = conn.Close()

	// receives nil on success
	errChan := make(chan error)

	// Simple check if the server is an electrum server.
	jsonrpcClient := jsonrpc.NewRPCClient(
		backends,
		func(err error) {
			select {
			case errChan <- err:
			default:
			}
		},
		log,
	)
	electrumClient := client.NewElectrumClient(jsonrpcClient, log)
	// We have two sources of errors, general communication errors and method specific errors.
	// We receive the first one that comes back.
	defer electrumClient.Close()
	go func() {
		_, err := electrumClient.ServerVersion()
		select {
		case errChan <- err:
		default:
		}
	}()
	return <-errChan
}

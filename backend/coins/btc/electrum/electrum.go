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
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
	"github.com/digitalbitbox/block-client-go/electrum"
	"github.com/digitalbitbox/block-client-go/failover"
	"github.com/sirupsen/logrus"
	"golang.org/x/net/proxy"
)

// softwareVersion reports to an electrum protocol compatible server
// its name and a version so that server owners can identify what kind of
// clients are connected.
// It is set at the app startup in the backend and never changes during the runtime.
var softwareVersion = "BitBoxApp/uninitialized"

// SetClientSoftwareVersion updates an electrumx client software version string
// sent to the servers during the protocol version negotiation.
// This is purely informational and has no impact on supported protocol versions.
// SetClientSoftwareVersion is unsafe for concurrent use.
func SetClientSoftwareVersion(v *semver.SemVer) {
	softwareVersion = fmt.Sprintf("BitBoxApp/%s", v)
}

// establishConnection connects to a backend and returns an rpc client
// or an error if the connection could not be established.
func establishConnection(
	serverInfo *config.ServerInfo, dialer proxy.Dialer) (net.Conn, error) {
	var conn net.Conn
	if serverInfo.TLS {
		var err error
		conn, err = newTLSConnection(serverInfo.Server, serverInfo.PEMCert, dialer)
		if err != nil {
			return nil, err
		}
	} else {
		var err error
		conn, err = newTCPConnection(serverInfo.Server, dialer)
		if err != nil {
			return nil, err
		}
	}
	return conn, nil
}

func newTLSConnection(address string, rootCert string, dialer proxy.Dialer) (*tls.Conn, error) {
	// hostname is used as server name in SNI client hello during the handshake.
	// It is set to empty string by tls.Client if address is an IP address.
	hostname, _, err := net.SplitHostPort(address)
	if err != nil {
		return nil, errp.WithMessage(err, fmt.Sprintf("Invalid server address %q", address))
	}

	caCertPool := x509.NewCertPool()
	if ok := caCertPool.AppendCertsFromPEM([]byte(rootCert)); !ok {
		return nil, errp.New("Failed to append CA cert as trusted cert")
	}
	conn, err := dialer.Dial("tcp", address)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	tlsConn := tls.Client(conn, &tls.Config{
		ServerName: hostname,
		RootCAs:    caCertPool,
		// Expecting a self-signed cert.
		// See custom verification against a rootCert in VerifyPeerCertificate.
		InsecureSkipVerify: true,
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
	return tlsConn, nil
}

func newTCPConnection(address string, dialer proxy.Dialer) (net.Conn, error) {
	conn, err := dialer.Dial("tcp", address)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return conn, nil
}

// NewElectrumConnection connects to an Electrum server and returns a ElectrumClient instance to
// communicate with it.
func NewElectrumConnection(serverInfos []*config.ServerInfo, log *logrus.Entry, dialer proxy.Dialer) blockchain.Interface {
	var serverList string
	for _, serverInfo := range serverInfos {
		if serverList != "" {
			serverList += ", "
		}
		serverList += serverInfo.Server
	}
	log = log.WithFields(logrus.Fields{"group": "electrum", "servers": serverList})
	log.Debug("Connecting to Electrum server")

	servers := []*failover.Server[*client]{}
	retryTimeout := 30 * time.Second

	for _, serverInfo := range serverInfos {
		serverInfo := serverInfo
		servers = append(servers, &failover.Server[*client]{
			Name: serverInfo.Server,
			Connect: func() (*client, error) {
				log := log.WithField("server", serverInfo.String())
				log.Info("Trying to connect to backend")
				c, err := electrum.Connect(&electrum.Options{
					SoftwareVersion: softwareVersion,
					// Slightly less than PingInterval according to the `electrum.Options` docs - a
					// ping is a method call by itself.
					MethodTimeout: 50 * time.Second,
					PingInterval:  time.Minute,
					Dial: func() (net.Conn, error) {
						return establishConnection(serverInfo, dialer)
					},
				})
				if err != nil {
					log.WithError(err).Error("Failover: backend is down")
					return nil, err
				}
				log.
					WithField("server-version", c.ServerVersion().String()).
					Infof("Successfully connected to backend %s", serverInfo.Server)
				return &client{client: c}, nil
			},
		})
	}
	var fclient *failoverClient
	fclient = newFailoverClient(&failover.Options[*client]{
		Servers:      servers,
		RetryTimeout: retryTimeout,
		OnConnect: func(server *failover.Server[*client]) {
			fclient.setConnectionError(nil)
		},
		OnDisconnect: func(server *failover.Server[*client], err error) {
			log.
				WithError(err).
				WithField("server", server.String()).
				Errorf("backend disconnected")
		},
		OnRetry: func(err error) {
			log.WithError(err).Errorf("All backends failed, retrying after %v", retryTimeout)
			if err != nil {
				fclient.setConnectionError(err)
			} else {
				// Shouldn't happen, a fallback just in case.
				fclient.setConnectionError(errors.New("Servers unreachable"))
			}
		},
	})
	return fclient
}

// DownloadCert downloads the first element of the remote certificate chain.
func DownloadCert(server string, dialer proxy.Dialer) (string, error) {
	// hostname is used as server name in SNI client hello during the handshake.
	// It is set to empty string by tls.Client if address is an IP address.
	hostname, _, err := net.SplitHostPort(server)
	if err != nil {
		return "", errp.WithMessage(err, fmt.Sprintf("Invalid server address %q", server))
	}

	var pemCert []byte
	conn, err := dialer.Dial("tcp", server)
	if err != nil {
		return "", errp.WithStack(err)
	}

	tlsConn := tls.Client(conn, &tls.Config{
		ServerName: hostname,
		// Just fetching the cert. No need to verify.
		// newTLSConnection is where the actual connection happens and the cert is verified.
		InsecureSkipVerify: true,
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
func CheckElectrumServer(serverInfo *config.ServerInfo, log *logrus.Entry, dialer proxy.Dialer) error {
	client, err := electrum.Connect(&electrum.Options{
		SoftwareVersion: softwareVersion,
		MethodTimeout:   30 * time.Second,
		PingInterval:    -1,
		Dial: func() (net.Conn, error) {
			return establishConnection(serverInfo, dialer)
		},
	})
	if err != nil {
		return err
	}
	client.Close()
	return nil
}

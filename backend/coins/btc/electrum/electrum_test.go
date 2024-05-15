// Copyright 2021 Shift Crypto AG
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
	"crypto/tls"
	"io"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDownloadCert(t *testing.T) {
	tt := []struct{ targetServer, wantServerName string }{
		{"node.example.org:123", "node.example.org"},
		{"1.2.3.4:123", ""},
	}
	for _, testcase := range tt {
		testcase := testcase
		t.Run(testcase.targetServer, func(t *testing.T) {
			// Set up a fake ElectrumX node.
			var didHandshake bool
			fakeNode := &test.TCPServer{
				GetCertificate: func(hello *tls.ClientHelloInfo) (*tls.Certificate, error) {
					didHandshake = true
					assert.Equal(t, testcase.wantServerName, hello.ServerName, "hello.ServerName")
					return test.TCPServerCert, nil
				},
			}
			fakeNode.StartTLS(func(conn net.Conn) {
				conn.Write([]byte("ok")) // unused; just to finish TLS handshake
				conn.Close()
			})
			defer fakeNode.Close()

			// Make sure the client always connects directly to the fake node.
			dialer := &test.Dialer{DialFn: func(network, addr string) (net.Conn, error) {
				assert.Equal(t, testcase.targetServer, addr, "dialer addr")
				return fakeNode.Dialer().Dial(network, addr)
			}}

			// Run the test.
			done := make(chan struct{})
			go func() {
				cert, err := DownloadCert(testcase.targetServer, dialer)
				require.NoError(t, err, "DownloadCert")
				expected, actual := strings.TrimSpace(test.TCPServerCertPub), strings.TrimSpace(cert)
				assert.Equal(t, expected, actual, "DownloadCert")
				assert.True(t, didHandshake, "didHandshake")
				close(done)
			}()

			select {
			case <-time.After(3 * time.Second):
				t.Fatal("DownloadCert took too long to return")
			case <-done:
				// ok
			}
		})
	}
}

func TestEstablishConnectionTLS(t *testing.T) {
	tt := []struct{ targetServer, wantServerName string }{
		{"node.example.org:123", "node.example.org"},
		{"1.2.3.4:123", ""},
	}
	for _, testcase := range tt {
		testcase := testcase
		t.Run(testcase.targetServer, func(t *testing.T) {
			// Set up a fake ElectrumX node.
			var didHandshake bool
			fakeNode := &test.TCPServer{
				GetCertificate: func(hello *tls.ClientHelloInfo) (*tls.Certificate, error) {
					didHandshake = true
					assert.Equal(t, testcase.wantServerName, hello.ServerName, "hello.ServerName")
					return test.TCPServerCert, nil
				},
			}
			fakeNode.StartTLS(func(conn net.Conn) {
				io.Copy(conn, conn) // echo back all incoming data
				conn.Close()
			})
			defer fakeNode.Close()

			// Make sure the client always connects directly to the fake node.
			dialer := &test.Dialer{DialFn: func(network, addr string) (net.Conn, error) {
				assert.Equal(t, testcase.targetServer, addr, "dialer addr")
				return fakeNode.Dialer().Dial(network, addr)
			}}

			// Run the test.
			info := &config.ServerInfo{
				Server:  testcase.targetServer,
				TLS:     true,
				PEMCert: test.TCPServerCertPub,
			}
			done := make(chan struct{})
			go func() {
				conn, err := establishConnection(info, dialer)
				require.NoError(t, err, "establishConnection")
				conn.Write([]byte("hello"))
				var buf = make([]byte, 5)
				conn.Read(buf)
				assert.Equal(t, "hello", string(buf), "conn.Read")
				conn.Close()
				assert.True(t, didHandshake, "didHandshake")
				close(done)
			}()

			select {
			case <-time.After(3 * time.Second):
				t.Fatal("establishConnection took too long to return")
			case <-done:
				// ok
			}
		})
	}
}

// SPDX-License-Identifier: Apache-2.0

package test

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"

	"golang.org/x/net/proxy"
)

// TCPServerCertKey is the private key of TCPServerCert in PEM encoding.
// It was generated with:
//
//	openssl ecparam -out key.pem -name secp256r1 -genkey; cat key.pem
const TCPServerCertKey = `
-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIFlVUmHt+140ZsJz0i2QlFd9m3zLNKQ0FmadLADGWKJvoAoGCCqGSM49
AwEHoUQDQgAERPPEMbqPxez20a2UIj9YpMkOOTBgdSetREcTYE7VSiL7lFgQWlfF
jXbEaVL0nhsoi2DbNJbGzMaIBhyYrtaFAw==
-----END EC PRIVATE KEY-----
`

// TCPServerCertPub is the TCPServerCert in PEM encoding.
// It was generated with:
//
//	openssl req -new -key key.pem -x509 -nodes -days 10000 \
//	  -subj '/CN=node.example.org' \
//	  -addext 'subjectAltName=DNS:node.example.org'
const TCPServerCertPub = `
-----BEGIN CERTIFICATE-----
MIIBTDCB8qADAgECAgkAqux29iMFU0UwCgYIKoZIzj0EAwIwGzEZMBcGA1UEAwwQ
bm9kZS5leGFtcGxlLm9yZzAeFw0yMTAzMTIwOTI0MzRaFw00ODA3MjgwOTI0MzRa
MBsxGTAXBgNVBAMMEG5vZGUuZXhhbXBsZS5vcmcwWTATBgcqhkjOPQIBBggqhkjO
PQMBBwNCAARE88Qxuo/F7PbRrZQiP1ikyQ45MGB1J61ERxNgTtVKIvuUWBBaV8WN
dsRpUvSeGyiLYNs0lsbMxogGHJiu1oUDox8wHTAbBgNVHREEFDASghBub2RlLmV4
YW1wbGUub3JnMAoGCCqGSM49BAMCA0kAMEYCIQDfskJocH4jPevTZx0f5etZ3akR
gpYpt6sWjQN6ZmEHzAIhAPUJx39HV+wXUfiYe4fwlAPihLZyFl1Hy3pfRwit1SZ9
-----END CERTIFICATE-----
`

// TCPServerCert is the default certificate presented to the clients
// by TCPServer if its GetCertificate field was nil at the time StartTLS is called.
var TCPServerCert *tls.Certificate

func init() {
	cert, err := tls.X509KeyPair([]byte(TCPServerCertPub), []byte(TCPServerCertKey))
	if err != nil {
		panic(fmt.Sprintf("test/TCPServerCert: %v", err))
	}
	TCPServerCert = &cert
}

// TCPServer listens on a randomly chosen TCP port on localhost.
// To start listening, call StartTLS. To stop, use Close.
type TCPServer struct {
	// GetCertificate allows callers to present different certificates based on
	// the client hello. This requires clients to support SNI.
	// The field is set directly to tls.Config's GetCertificate.
	// If nil, TCPServerCert is used.
	GetCertificate func(*tls.ClientHelloInfo) (*tls.Certificate, error)

	listener net.Listener
	quit     chan struct{}
}

// StartTLS makes the server start listening for incoming connections
// and pass them on to the accept function, each in a separate goroutine.
// It chooses a random port on localhost. To connect to the server, use s.Dialer.
// To stop listening, call s.Close.
//
// StartTLS panics if it's unable to start listening.
func (s *TCPServer) StartTLS(accept func(net.Conn)) {
	// Set up TLS config.
	conf := &tls.Config{GetCertificate: s.GetCertificate}
	if conf.GetCertificate == nil {
		conf.GetCertificate = func(*tls.ClientHelloInfo) (*tls.Certificate, error) {
			return TCPServerCert, nil
		}
	}
	// Start listening on a random port. Some systems may support only IPv6.
	l, err := tls.Listen("tcp", "127.0.0.1:0", conf)
	if err != nil {
		l, err = tls.Listen("tcp6", "[::1]:0", conf)
	}
	if err != nil {
		panic(fmt.Sprintf("test/TCPServer.StartTLS: %v", err))
	}
	s.listener = l

	// Accept new connections until we're told to quit.
	s.quit = make(chan struct{})
	go func() {
		for {
			conn, err := s.listener.Accept()
			select {
			case <-s.quit:
				return
			default:
				// continue
			}
			if err != nil {
				log.Printf("test/TCPServer accept: %v", err)
				continue
			}
			go accept(conn)
		}
	}()
}

// Dialer allows clients to connect to the started server.
// It always ignores Dial's network and addr arguments.
func (s *TCPServer) Dialer() proxy.Dialer {
	return &Dialer{DialFn: func(network, addr string) (net.Conn, error) {
		return net.Dial(s.listener.Addr().Network(), s.listener.Addr().String())
	}}
}

// Close stops listening. Callers are responsible for closing any idle connections
// passed on to accept function in StartTLS.
func (s *TCPServer) Close() {
	close(s.quit)
	s.listener.Close() //nolint:errcheck
}

// Dialer satisfies x/net/proxy.Dialer.
// It always passes the calls onto its DialFn.
type Dialer struct {
	DialFn func(network, addr string) (net.Conn, error)
}

// Dial simply calls d.DialFn.
func (d *Dialer) Dial(network, addr string) (net.Conn, error) {
	return d.DialFn(network, addr)
}

package main

import "C"

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/shiftdevices/godbb/util/errp"

	"github.com/shiftdevices/godbb/backend"
	backendHandlers "github.com/shiftdevices/godbb/backend/handlers"
	"github.com/shiftdevices/godbb/util/freeport"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"
)

const (
	// RSA key size.
	rsaBits = 2048
	// Name of the server certificate
	tlsServerCertificate = "config/certificates/frontend/server.pem"
)

// generateRSAPrivateKey generates an RSA key pair and wraps it in the type rsa.PrivateKey.
func generateRSAPrivateKey() (*rsa.PrivateKey, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, rsaBits)
	if err != nil {
		log.Fatalf("Failed to create private key: %s", err)
		return nil, err
	}
	return privateKey, nil
}

// createSelfSignedCertificate creates a self-signed certificate from the given rsa.PrivateKey.
func createSelfSignedCertificate(privateKey *rsa.PrivateKey, logEntry *logrus.Entry) ([]byte, error) {
	serialNumber := big.Int{}
	notBefore := time.Now()
	// Invalid after one day.
	notAfter := notBefore.AddDate(0, 0, 1)
	template := x509.Certificate{
		SerialNumber: &serialNumber,
		Subject: pkix.Name{
			Country:            []string{"CH"},
			Organization:       []string{"Shift Cryptosecurity"},
			OrganizationalUnit: []string{"godbb"},
		},
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IPAddresses:           []net.IP{net.IPv4(127, 0, 0, 1), net.ParseIP("::1")},
		DNSNames:              []string{"localhost"},
		IsCA:                  true,
	}
	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, privateKey.Public(), privateKey)
	if err != nil {
		logEntry.WithField("error", err).Error("Failed to create x.509 certificate")
		return nil, err
	}
	return derBytes, nil
}

// saveAsPEM saves the given PEM block as a file
func saveAsPEM(name string, pemBytes *pem.Block, logEntry *logrus.Entry) error {
	certificateDir := filepath.Dir(name)
	err := os.MkdirAll(certificateDir, os.ModeDir|os.ModePerm)
	if err != nil {
		return errp.WithContext(errp.WithMessage(err, "Failed to create directory for server certificate"),
			errp.Context{"certificate-directory": certificateDir})
	}
	pemFile, err := os.Create(name)
	if err != nil {
		return errp.WithContext(errp.WithMessage(err, "Failed to create server certificate"),
			errp.Context{"file": name})
	}
	err = pem.Encode(pemFile, pemBytes)
	if err != nil {
		return errp.WithContext(errp.WithMessage(err, "Failed to write PEM encoded server certificate file"),
			errp.Context{"file": pemFile.Name()})
	}
	err = pemFile.Close()
	if err != nil {
		return errp.WithContext(errp.WithMessage(err, "Failed to close server certificate file"),
			errp.Context{"file": pemFile.Name()})
	}
	return nil
}

// derToPem wraps the givem PEM bytes and PEM type in a PEM block.
func derToPem(pemType string, pemBytes []byte) *pem.Block {
	return &pem.Block{Type: pemType, Bytes: pemBytes}
}

// Copied and adapted from package http server.go.
//
// tcpKeepAliveListener sets TCP keep-alive timeouts on accepted
// connections. It's used by ListenAndServe and ListenAndServeTLS so
// dead TCP connections (e.g. closing laptop mid-download) eventually
// go away.
type tcpKeepAliveListener struct {
	*net.TCPListener
}

// accept enables TCP keep alive and sets the period to 3 minutes.
func (ln tcpKeepAliveListener) Accept() (net.Conn, error) {
	tc, err := ln.AcceptTCP()
	if err != nil {
		return nil, err
	}
	tc.SetKeepAlive(true)
	tc.SetKeepAlivePeriod(3 * time.Minute)
	return tc, nil
}

//export serve
func serve() int {
	logEntry := logging.Log.WithGroup("server")
	port, err := freeport.FreePort(logEntry)
	if err != nil {
		logEntry.WithField("error", err).Fatal("Failed to find free port")
	}
	logEntry.WithField("port", port).Debug("Serve backend")
	handlers := backendHandlers.NewHandlers(backend.NewBackend(), port)

	privateKey, err := generateRSAPrivateKey()
	if err != nil {
		logEntry.WithField("error", err).Fatal("Failed to generate RSA key")
	}
	certificate, err := createSelfSignedCertificate(privateKey, logEntry)
	if err != nil {
		logEntry.WithField("error", err).Fatal("Failed to create self-signed certificate")
	}
	certificatePEM := derToPem("CERTIFICATE", certificate)
	saveAsPEM(tlsServerCertificate, certificatePEM, logEntry)

	var certAndKey tls.Certificate
	certAndKey.Certificate = [][]byte{certificate}
	certAndKey.PrivateKey = privateKey

	go func() {
		server := &http.Server{
			Addr:    fmt.Sprintf("localhost:%d", port),
			Handler: handlers.Router,
			TLSConfig: &tls.Config{
				NextProtos:   []string{"http/1.1"},
				Certificates: []tls.Certificate{certAndKey},
			},
		}
		listener, err := net.Listen("tcp", server.Addr)
		if err != nil {
			logEntry.WithFields(logrus.Fields{"error": err, "address": server.Addr}).Fatal("Failed to listen on address")
		}
		logEntry.WithField("address", server.Addr).Debug("Listening")
		tlsListener := tls.NewListener(tcpKeepAliveListener{listener.(*net.TCPListener)}, server.TLSConfig)
		err = server.Serve(tlsListener)
		if err != nil {
			logEntry.WithFields(logrus.Fields{"error": err, "address": server.Addr}).Fatal("Failed to establish TLS endpoint")
		}
	}()
	return port
}

// Don't remove - needed for the C compilation.
func main() {
}

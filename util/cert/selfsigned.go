// SPDX-License-Identifier: Apache-2.0

package cert

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"log"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

const (
	// RSA key size.
	rsaBits = 2048
)

// generateRSAPrivateKey generates an RSA key pair and wraps it in the type rsa.PrivateKey.
//
//nolint:unparam
func generateRSAPrivateKey() (*rsa.PrivateKey, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, rsaBits)
	if err != nil {
		log.Fatalf("Failed to create private key: %s", err)
		return nil, err
	}
	return privateKey, nil
}

// createSelfSignedCertificate creates a self-signed certificate from the given rsa.PrivateKey.
func createSelfSignedCertificate(privateKey *rsa.PrivateKey, log *logrus.Entry) ([]byte, error) {
	serialNumber := big.Int{}
	notBefore := time.Now()
	// Invalid after one day.
	notAfter := notBefore.AddDate(0, 0, 1)
	template := x509.Certificate{
		SerialNumber: &serialNumber,
		Subject: pkix.Name{
			Country:            []string{"CH"},
			Organization:       []string{"Shift Crypto"},
			OrganizationalUnit: []string{"BitBoxApp"},
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
		log.WithError(err).Error("Failed to create x.509 certificate")
		return nil, err
	}
	return derBytes, nil
}

// saveAsPEM saves the given PEM block as a file.
func saveAsPEM(name string, pemBytes *pem.Block) error {
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

// SaveNewSelfSignedPEM is sample code of how to create and store a new random self signed
// certificate and create a resulting tls.Config to secure http connections.
func SaveNewSelfSignedPEM(filename string) (*tls.Config, error) {
	log := logging.Get().WithGroup("selfsigned")
	privateKey, err := generateRSAPrivateKey()
	if err != nil {
		return nil, err
	}
	certificate, err := createSelfSignedCertificate(privateKey, log)
	if err != nil {
		return nil, err
	}
	certificatePEM := derToPem("CERTIFICATE", certificate)
	if err := saveAsPEM(filename, certificatePEM); err != nil {
		return nil, err
	}
	var certAndKey tls.Certificate
	certAndKey.Certificate = [][]byte{certificate}
	certAndKey.PrivateKey = privateKey
	return &tls.Config{
		NextProtos:   []string{"http/1.1"},
		Certificates: []tls.Certificate{certAndKey},
	}, nil
}

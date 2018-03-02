package main

import (
	"crypto/x509"
	"encoding/pem"
	"io/ioutil"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/stretchr/testify/suite"
)

type serverTestSuite struct {
	suite.Suite
}

func TestServerTestSuite(t *testing.T) {
	suite.Run(t, &serverTestSuite{})
}

func (s *serverTestSuite) TestNewRSAPrivateKey() {
	privateKey, err := generateRSAPrivateKey()
	require.NoError(s.T(), err)
	require.NotEmpty(s.T(), privateKey)
	require.NotEmpty(s.T(), privateKey.PublicKey)
}

func (s *serverTestSuite) TestNewCertificate() {
	privateKey, _ := generateRSAPrivateKey()
	certificate, err := createSelfSignedCertificate(privateKey)
	require.NoError(s.T(), err)
	require.NotEmpty(s.T(), certificate)
	x509Cert, err := x509.ParseCertificate(certificate)
	require.NoError(s.T(), err)
	require.NotNil(s.T(), x509Cert)
	err = x509Cert.VerifyHostname("localhost")
	require.NoError(s.T(), err)
	require.True(s.T(), time.Now().After(x509Cert.NotBefore))
	require.True(s.T(), time.Now().AddDate(0, 0, 1).After(x509Cert.NotAfter))
}

func (s *serverTestSuite) TestSavingCertAsPEM() {
	privateKey, _ := generateRSAPrivateKey()
	certificate, _ := createSelfSignedCertificate(privateKey)
	err := saveAsPEM("cert_test.pem", derToPem("CERTIFICATE", certificate))
	require.NoError(s.T(), err)
	_, err = os.Stat("cert_test.pem")
	require.NoError(s.T(), err)
	pemBytes, err := ioutil.ReadFile("cert_test.pem")
	require.NoError(s.T(), err)
	pemBlock, rest := pem.Decode(pemBytes)
	require.NotNil(s.T(), pemBlock)
	require.EqualValues(s.T(), certificate, pemBlock.Bytes)
	require.Empty(s.T(), rest)
}

package main

import (
	"crypto/x509"
	"encoding/pem"
	"io/ioutil"
	"os"
	"testing"
	"time"

	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"

	"github.com/stretchr/testify/suite"
)

type serverTestSuite struct {
	suite.Suite

	logEntry *logrus.Entry
}

func TestServerTestSuite(t *testing.T) {
	suite.Run(t, &serverTestSuite{
		logEntry: logging.Log.WithGroup("main"),
	})
}

func (s *serverTestSuite) TestNewRSAPrivateKey() {
	privateKey, err := generateRSAPrivateKey()
	require.NoError(s.T(), err)
	require.NotEmpty(s.T(), privateKey)
	require.NotEmpty(s.T(), privateKey.PublicKey)
}

func (s *serverTestSuite) TestNewCertificate() {
	privateKey, _ := generateRSAPrivateKey()
	certificate, err := createSelfSignedCertificate(privateKey, s.logEntry)
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
	certificate, _ := createSelfSignedCertificate(privateKey, s.logEntry)
	f, err := ioutil.TempFile(".", "cert_test.pem")
	require.NoError(s.T(), err)
	temporaryFile := f.Name()
	defer func() {
		if _, err = os.Stat(temporaryFile); !os.IsNotExist(err) {
			require.NoError(s.T(), err)
			err = os.Remove(temporaryFile)
			require.NoError(s.T(), err)
		}
	}()
	err = saveAsPEM(f.Name(), derToPem("CERTIFICATE", certificate), s.logEntry)
	require.NoError(s.T(), err)
	_, err = os.Stat(f.Name())
	require.NoError(s.T(), err)
	pemBytes, err := ioutil.ReadFile(f.Name())
	require.NoError(s.T(), err)
	pemBlock, rest := pem.Decode(pemBytes)
	require.NotNil(s.T(), pemBlock)
	require.EqualValues(s.T(), certificate, pemBlock.Bytes)
	require.Empty(s.T(), rest)
}

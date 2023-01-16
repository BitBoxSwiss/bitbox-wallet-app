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

package cert

import (
	"crypto/x509"
	"encoding/pem"
	"os"
	"testing"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type certTestSuite struct {
	suite.Suite

	log *logrus.Entry
}

func TestCertTestSuite(t *testing.T) {
	suite.Run(t, &certTestSuite{
		log: logging.Get().WithGroup("main"),
	})
}

func (s *certTestSuite) TestNewRSAPrivateKey() {
	privateKey, err := generateRSAPrivateKey()
	require.NoError(s.T(), err)
	require.NotEmpty(s.T(), privateKey)
	require.NotEmpty(s.T(), privateKey.PublicKey)
}

func (s *certTestSuite) TestNewCertificate() {
	privateKey, _ := generateRSAPrivateKey()
	certificate, err := createSelfSignedCertificate(privateKey, s.log)
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

func (s *certTestSuite) TestSavingCertAsPEM() {
	privateKey, _ := generateRSAPrivateKey()
	certificate, _ := createSelfSignedCertificate(privateKey, s.log)
	temporaryFile := test.TstTempFile("cert_test.pem")
	defer func() {
		if _, err := os.Stat(temporaryFile); !os.IsNotExist(err) {
			require.NoError(s.T(), err)
			err = os.Remove(temporaryFile)
			require.NoError(s.T(), err)
		}
	}()
	err := saveAsPEM(temporaryFile, derToPem("CERTIFICATE", certificate))
	require.NoError(s.T(), err)
	_, err = os.Stat(temporaryFile)
	require.NoError(s.T(), err)
	pemBytes, err := os.ReadFile(temporaryFile)
	require.NoError(s.T(), err)
	pemBlock, rest := pem.Decode(pemBytes)
	require.NotNil(s.T(), pemBlock)
	require.EqualValues(s.T(), certificate, pemBlock.Bytes)
	require.Empty(s.T(), rest)
}

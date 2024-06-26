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

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/sirupsen/logrus"
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
	s.Require().NoError(err)
	s.Require().NotEmpty(privateKey)
	s.Require().NotEmpty(privateKey.PublicKey)
}

func (s *certTestSuite) TestNewCertificate() {
	privateKey, _ := generateRSAPrivateKey()
	certificate, err := createSelfSignedCertificate(privateKey, s.log)
	s.Require().NoError(err)
	s.Require().NotEmpty(certificate)
	x509Cert, err := x509.ParseCertificate(certificate)
	s.Require().NoError(err)
	s.Require().NotNil(x509Cert)
	err = x509Cert.VerifyHostname("localhost")
	s.Require().NoError(err)
	s.Require().True(time.Now().After(x509Cert.NotBefore))
	s.Require().True(time.Now().AddDate(0, 0, 1).After(x509Cert.NotAfter))
}

func (s *certTestSuite) TestSavingCertAsPEM() {
	privateKey, _ := generateRSAPrivateKey()
	certificate, _ := createSelfSignedCertificate(privateKey, s.log)
	temporaryFile := test.TstTempFile("cert_test.pem")
	defer func() {
		if _, err := os.Stat(temporaryFile); !os.IsNotExist(err) {
			s.Require().NoError(err)
			err = os.Remove(temporaryFile)
			s.Require().NoError(err)
		}
	}()
	err := saveAsPEM(temporaryFile, derToPem("CERTIFICATE", certificate))
	s.Require().NoError(err)
	_, err = os.Stat(temporaryFile)
	s.Require().NoError(err)
	pemBytes, err := os.ReadFile(temporaryFile)
	s.Require().NoError(err)
	pemBlock, rest := pem.Decode(pemBytes)
	s.Require().NotNil(pemBlock)
	s.Require().EqualValues(certificate, pemBlock.Bytes)
	s.Require().Empty(rest)
}

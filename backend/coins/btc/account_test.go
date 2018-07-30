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

package btc_test

// import (
// 	"github.com/btcsuite/btcd/chaincfg"
// 	"github.com/shiftdevices/godbb/backend/coins/btc"
// 	blockchainMock "github.com/shiftdevices/godbb/backend/coins/btc/blockchain/mocks"
// 	"github.com/shiftdevices/godbb/backend/keystore/mocks"
// 	"github.com/sirupsen/logrus"
// 	"github.com/stretchr/testify/suite"
// )

// type accountSuite struct {
// 	suite.Suite

// 	net            *chaincfg.Params
// 	keyStoreMock   mocks.Keystore
// 	blockchainMock blockchainMock.Interface
// 	onEvent        func(btc.Event)
// 	account        *btc.Account

// 	log *logrus.Entry
// }

// func (s *accountSuite) SetupTest() {
// 	s.log = logging.Log.WithGroup("btc_test")
// 	s.net = &chaincfg.TestNet3Params
// 	s.onEvent = func(btc.Event) {}
// 	var err error

// 	const xpubSerialized = "tpubDEXZPZzoVxHQdZg6ndWKoDXwsPtfTKpYsF6SDCm2dHxydcNvoKM58RmA7FDj3hXqy8BrxfwoTNaV5SzWgCzurTaQmDNywHVvv5tPSj6Evgr"
// 	xpub, err := hdkeychain.NewKeyFromString(xpubSerialized)
// 	if err != nil || xpub.IsPrivate() {
// 		panic(err)
// 	}

// 	db, err := transactionsdb.NewDB(test.TstTempFile("godbb-db-"))
// 	if err != nil {
// 		panic(err)
// 	}
// 	s.keyStoreMock.On("XPub").Return(xpub)
// 	s.account, err = btc.NewAccount(
// 		s.net,
// 		db,
// 		signing.NewEmptyAbsoluteKeypath(),
// 		&s.keyStoreMock,
// 		&s.blockchainMock,
// 		&headersMock.Interface{},
// 		addresses.AddressTypeP2PKH,
// 		s.onEvent,
// 		s.log,
// 	)
// 	if err != nil {
// 		panic(err)
// 	}
// }

// func TestAccountSuite(t *testing.T) {
// 	suite.Run(t, &accountSuite{})
// }

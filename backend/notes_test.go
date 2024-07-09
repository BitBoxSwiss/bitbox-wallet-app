// Copyright 2024 Shift Crypto AG
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

package backend

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/notes"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/suite"
)

type notesTestSuite struct {
	suite.Suite
	backend *Backend
}

func (s *notesTestSuite) SetupTest() {
	s.backend = newBackend(s.T(), testnetDisabled, regtestDisabled)

	notesInstances := map[accountsTypes.Code]*notes.Notes{}
	notesFunc := func(accountCode accountsTypes.Code) func() *notes.Notes {
		return func() *notes.Notes {
			if notesInstances[accountCode] == nil {
				notesInstance, err := notes.LoadNotes(test.TstTempFile("notes"))
				s.Require().NoError(err)
				notesInstances[accountCode] = notesInstance
			}
			return notesInstances[accountCode]
		}
	}
	// We mock some transactions so that in the import, transactions can be looked up by ID.
	transactionsFunc := func(accountCode accountsTypes.Code) func() (accounts.OrderedTransactions, error) {
		return func() (accounts.OrderedTransactions, error) {
			switch accountCode {
			case "v0-55555555-btc-0":
				return accounts.OrderedTransactions{
					&accounts.TransactionData{
						InternalID: "btc-tx-id",
					},
				}, nil
			case "v0-55555555-eth-0":
				return accounts.OrderedTransactions{
					&accounts.TransactionData{
						InternalID: "eth-tx-id",
					},
				}, nil
			case Erc20AccountCode("v0-55555555-eth-0", "eth-erc20-usdt"):
				return accounts.OrderedTransactions{
					&accounts.TransactionData{
						InternalID: "erc20-tx-id",
					},
				}, nil
			default:
				return nil, nil
			}
		}
	}

	s.backend.makeBtcAccount = func(config *accounts.AccountConfig, coin *btc.Coin, gapLimits *types.GapLimits, log *logrus.Entry) accounts.Interface {
		accountMock := MockBtcAccount(s.T(), config, coin, gapLimits, log)
		accountMock.NotesFunc = notesFunc(config.Config.Code)
		accountMock.TransactionsFunc = transactionsFunc(config.Config.Code)

		return accountMock
	}
	s.backend.makeEthAccount = func(config *accounts.AccountConfig, coin *eth.Coin, httpClient *http.Client, log *logrus.Entry) accounts.Interface {
		accountMock := MockEthAccount(config, coin, httpClient, log)
		accountMock.NotesFunc = notesFunc(config.Config.Code)
		accountMock.TransactionsFunc = transactionsFunc(config.Config.Code)
		return accountMock
	}

	bb02Multi := makeBitBox02Multi()
	s.backend.registerKeystore(bb02Multi)
	checkShownAccountsLen(s.T(), s.backend, 3, 3)

	// Activate an ERC20 token.
	s.Require().NoError(s.backend.SetTokenActive("v0-55555555-eth-0", "eth-erc20-usdt", true))
}

func (s *notesTestSuite) TearDownTest() {
	s.backend.Close()
}

func TestNotesSuite(t *testing.T) {
	suite.Run(t, &notesTestSuite{})
}

func (s *notesTestSuite) TestExport() {
	btcAcct := s.backend.Accounts().lookup("v0-55555555-btc-0")
	s.Require().NotNil(btcAcct)

	ethAcct := s.backend.Accounts().lookup("v0-55555555-eth-0")
	s.Require().NotNil(ethAcct)

	erc20Acct := s.backend.Accounts().lookup(Erc20AccountCode("v0-55555555-eth-0", "eth-erc20-usdt"))
	s.Require().NotNil(erc20Acct)

	// Labels of deactivated accounts are also exported. Let's deactivate an ETH account to check
	// that the child ERC20 account notes are still being exported.
	s.Require().NoError(s.backend.SetAccountActive("v0-55555555-eth-0", false))

	// Rename some accounts.
	s.Require().NoError(s.backend.RenameAccount("v0-55555555-btc-0", "My BTC"))
	s.Require().NoError(s.backend.RenameAccount("v0-55555555-eth-0", "My ETH"))

	_, err := btcAcct.Notes().SetTxNote("btc-tx-id", "test btc note")
	s.Require().NoError(err)
	_, err = ethAcct.Notes().SetTxNote("eth-tx-id", "test eth note")
	s.Require().NoError(err)
	_, err = erc20Acct.Notes().SetTxNote("erc20-tx-id", "test erc20 note")
	s.Require().NoError(err)

	var export bytes.Buffer
	s.Require().NoError(s.backend.exportNotes(&export))

	expected := `{"type":"xpub","ref":"xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn","label":"My BTC","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"xpub","ref":"xpub6CC9Tsi4eJvmRsGuXwKBfHDWUWN66voNeZFmXRJhYZS6yYgXKZmtz5qnxK9WL2FZP8uF3abyFZ29d7RfMks4FjCCu4LMh3edyeCoyEFuZLZ","label":"My BTC","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"xpub","ref":"xpub6CUmEcJb7juvnw7fFYybCwvCJuPSEdhTWZCep9X1DBznwB8RRKTYBUidbEPJ9L7ExjrXhem9S759cX3BpzSUSoP2rWh9vqumJ9MPSAbi98F","label":"My BTC","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"tx","ref":"btc-tx-id","label":"test btc note","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"xpub","ref":"xpub6DReBHtKxgeZGBKTaaF1GjeBHa8dZwQpRfgYr3kxt782s8KKqio2pR6piBsiqHEPF7Rg3onMkwt9XrSxNTuW4N1VBjVbn6DQ3GPCBEUgtgP","label":"Litecoin","bitboxapp":{"coinCode":"ltc","code":"v0-55555555-ltc-0"}}
{"type":"xpub","ref":"xpub6CrhULuXbYzo7gXNhSNZ6tzgfMWpwRFEisekvFfuWLtpXcV4jfvWf5yCuhRBvhZoisH4JCVp4ddGEi7XF2QE2S4N8pMkirJbp7N2TF5p5qQ","label":"Litecoin","bitboxapp":{"coinCode":"ltc","code":"v0-55555555-ltc-0"}}
{"type":"xpub","ref":"xpub6GP83vJASH1kS7dQPWXFjVHDfYajopbG8U3j8peBH67CRCnb8QmDxZJfWpbgCQNHAzCDJ4MyVYjoh7Yv9yo7PQuZ9YyktgrtD9vmeo67Y4E","label":"My ETH","bitboxapp":{"coinCode":"eth","code":"v0-55555555-eth-0"}}
{"type":"tx","ref":"eth-tx-id","label":"test eth note","bitboxapp":{"coinCode":"eth","code":"v0-55555555-eth-0"}}
{"type":"tx","ref":"erc20-tx-id","label":"test erc20 note","bitboxapp":{"coinCode":"eth-erc20-usdt","code":"v0-55555555-eth-0-eth-erc20-usdt"}}
`
	s.Require().Equal(expected, export.String())
}

func (s *notesTestSuite) TestNotesImport() {
	btcAcct := s.backend.Accounts().lookup("v0-55555555-btc-0")
	s.Require().NotNil(btcAcct)

	ltcAcct := s.backend.Accounts().lookup("v0-55555555-ltc-0")
	s.Require().NotNil(btcAcct)

	ethAcct := s.backend.Accounts().lookup("v0-55555555-eth-0")
	s.Require().NotNil(ethAcct)

	erc20Acct := s.backend.Accounts().lookup(Erc20AccountCode("v0-55555555-eth-0", "eth-erc20-usdt"))
	s.Require().NotNil(erc20Acct)

	// Sanity check that there are no notes.
	s.Require().Empty(btcAcct.Notes().TxNote("btc-tx-id"))

	export := `{"type":"xpub","ref":"xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn","label":"My BTC","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"xpub","ref":"xpub6CC9Tsi4eJvmRsGuXwKBfHDWUWN66voNeZFmXRJhYZS6yYgXKZmtz5qnxK9WL2FZP8uF3abyFZ29d7RfMks4FjCCu4LMh3edyeCoyEFuZLZ","label":"My BTC","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"xpub","ref":"xpub6CUmEcJb7juvnw7fFYybCwvCJuPSEdhTWZCep9X1DBznwB8RRKTYBUidbEPJ9L7ExjrXhem9S759cX3BpzSUSoP2rWh9vqumJ9MPSAbi98F","label":"My BTC","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"tx","ref":"btc-tx-id","label":"test btc note","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}

{"type":"xpub","ref":"xpub6DReBHtKxgeZGBKTaaF1GjeBHa8dZwQpRfgYr3kxt782s8KKqio2pR6piBsiqHEPF7Rg3onMkwt9XrSxNTuW4N1VBjVbn6DQ3GPCBEUgtgP","label":"Litecoin","bitboxapp":{"coinCode":"ltc","code":"v0-55555555-ltc-0"}}
{"type":"xpub","ref":"xpub6CrhULuXbYzo7gXNhSNZ6tzgfMWpwRFEisekvFfuWLtpXcV4jfvWf5yCuhRBvhZoisH4JCVp4ddGEi7XF2QE2S4N8pMkirJbp7N2TF5p5qQ","label":"Litecoin","bitboxapp":{"coinCode":"ltc","code":"v0-55555555-ltc-0"}}

{"type":"xpub","ref":"xpub6GP83vJASH1kS7dQPWXFjVHDfYajopbG8U3j8peBH67CRCnb8QmDxZJfWpbgCQNHAzCDJ4MyVYjoh7Yv9yo7PQuZ9YyktgrtD9vmeo67Y4E","label":"My ETH","bitboxapp":{"coinCode":"eth","code":"v0-55555555-eth-0"}}

{"type":"tx","ref":"eth-tx-id","label":"test eth note","bitboxapp":{"coinCode":"eth","code":"v0-55555555-eth-0"}}
{"type":"tx","ref":"erc20-tx-id","label":"test erc20 note","bitboxapp":{"coinCode":"eth-erc20-usdt","code":"v0-55555555-eth-0-eth-erc20-usdt"}}
{"type":"tx","ref":"non-existing-tx-id","label":"test note","bitboxapp":{"coinCode":"eth","code":"NON-EXISTING-ACCOUNT"}}
`
	result, err := s.backend.ImportNotes([]byte(export))
	s.Require().NoError(err)
	s.Require().Equal(
		&ImportNotesResult{
			AccountCount:     2,
			TransactionCount: 3,
		},
		result)

	s.Require().Equal("test btc note", btcAcct.Notes().TxNote("btc-tx-id"))
	s.Require().Equal("test eth note", ethAcct.Notes().TxNote("eth-tx-id"))
	s.Require().Equal("test erc20 note", erc20Acct.Notes().TxNote("erc20-tx-id"))
	s.Require().Equal("My BTC", btcAcct.Config().Config.Name)
	s.Require().Equal("Litecoin", ltcAcct.Config().Config.Name)
	s.Require().Equal("My ETH", ethAcct.Config().Config.Name)
}

func (s *notesTestSuite) TestNotesImportWithoutBitBoxAppData() {
	btcAcct := s.backend.Accounts().lookup("v0-55555555-btc-0")
	s.Require().NotNil(btcAcct)

	ltcAcct := s.backend.Accounts().lookup("v0-55555555-ltc-0")
	s.Require().NotNil(btcAcct)

	ethAcct := s.backend.Accounts().lookup("v0-55555555-eth-0")
	s.Require().NotNil(ethAcct)

	erc20Acct := s.backend.Accounts().lookup(Erc20AccountCode("v0-55555555-eth-0", "eth-erc20-usdt"))
	s.Require().NotNil(erc20Acct)

	// Sanity check that there are no notes.
	s.Require().Empty(btcAcct.Notes().TxNote("btc-tx-id"))

	veryLong := strings.Repeat("a", 2000)
	export := fmt.Sprintf(
		`{"type":"xpub","ref":"xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn","label":"My BTC"}
{"type":"xpub","ref":"xpub6CC9Tsi4eJvmRsGuXwKBfHDWUWN66voNeZFmXRJhYZS6yYgXKZmtz5qnxK9WL2FZP8uF3abyFZ29d7RfMks4FjCCu4LMh3edyeCoyEFuZLZ","label":"My BTC"}
{"type":"xpub","ref":"xpub6CUmEcJb7juvnw7fFYybCwvCJuPSEdhTWZCep9X1DBznwB8RRKTYBUidbEPJ9L7ExjrXhem9S759cX3BpzSUSoP2rWh9vqumJ9MPSAbi98F","label":"My BTC"}
{"type":"tx","ref":"btc-tx-id","label":"test btc note"}

{"type":"xpub","ref":"xpub6DReBHtKxgeZGBKTaaF1GjeBHa8dZwQpRfgYr3kxt782s8KKqio2pR6piBsiqHEPF7Rg3onMkwt9XrSxNTuW4N1VBjVbn6DQ3GPCBEUgtgP","label":"Litecoin"}
{"type":"xpub","ref":"xpub6CrhULuXbYzo7gXNhSNZ6tzgfMWpwRFEisekvFfuWLtpXcV4jfvWf5yCuhRBvhZoisH4JCVp4ddGEi7XF2QE2S4N8pMkirJbp7N2TF5p5qQ","label":"Litecoin"}

{"type":"xpub","ref":"xpub6GP83vJASH1kS7dQPWXFjVHDfYajopbG8U3j8peBH67CRCnb8QmDxZJfWpbgCQNHAzCDJ4MyVYjoh7Yv9yo7PQuZ9YyktgrtD9vmeo67Y4E","label":"My ETH"}
{"type":"tx","ref":"eth-tx-id","label":"test eth note"}
{"type":"tx","ref":"erc20-tx-id","label":"%s"}
{"type":"tx","ref":"non-existing-tx-id","label":"test note"}
`, veryLong)
	result, err := s.backend.ImportNotes([]byte(export))
	s.Require().NoError(err)
	s.Require().Equal(
		&ImportNotesResult{
			AccountCount:     2,
			TransactionCount: 3,
		},
		result)

	s.Require().Equal("test btc note", btcAcct.Notes().TxNote("btc-tx-id"))
	s.Require().Equal("test eth note", ethAcct.Notes().TxNote("eth-tx-id"))
	// Truncated to 1024 chars.
	s.Require().Equal(veryLong[:1024], erc20Acct.Notes().TxNote("erc20-tx-id"))
	s.Require().Equal("My BTC", btcAcct.Config().Config.Name)
	s.Require().Equal("Litecoin", ltcAcct.Config().Config.Name)
	s.Require().Equal("My ETH", ethAcct.Config().Config.Name)
}

func (s *notesTestSuite) TestNotesInvalidLine() {
	export := `{"type":"xpub","ref":"xpub6Cxa67Bfe1Aw5VvLM1Ppua9x28CXH1zUYoAuBzFRjR6hWnA6aUcny84KYkeVcZWnWXxKSkxCEyMA8xic54ydBPWm5oziXpsXq6nX8FELMQn","label":"My BTC","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"xpub","ref":"xpub6CC9Tsi4eJvmRsGuXwKBfHDWUWN66voNeZFmXRJhYZS6yYgXKZmtz5qnxK9WL2FZP8uF3abyFZ29d7RfMks4FjCCu4LMh3edyeCoyEFuZLZ","label":"My BTC","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"xpub","ref":"xpub6CUmEcJb7juvnw7fFYybCwvCJuPSEdhTWZCep9X1DBznwB8RRKTYBUidbEPJ9L7ExjrXhem9S759cX3BpzSUSoP2rWh9vqumJ9MPSAbi98F","label":"My BTC","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"tx","ref":"btc-tx-id","label":"test btc note","bitboxapp":{"coinCode":"btc","code":"v0-55555555-btc-0"}}
{"type":"xpub","ref":"xpub6DReBHtKxgeZGBKTaaF1GjeBHa8dZwQpRfgYr3kxt782s8KKqio2pR6piBsiqHEPF7Rg3onMkwt9XrSxNTuW4N1VBjVbn6DQ3GPCBEUgtgP","label":"Litecoin","bitboxapp":{"coinCode":"ltc","code":"v0-55555555-ltc-0"}}
{"type":"xpub","ref":"xpub6CrhULuXbYzo7gXNhSNZ6tzgfMWpwRFEisekvFfuWLtpXcV4jfvWf5yCuhRBvhZoisH4JCVp4ddGEi7XF2QE2S4N8pMkirJbp7N2TF5p5qQ","label":"Litecoin","bitboxapp":{"coinCode":"ltc","code":"v0-55555555-ltc-0"}}
{"type":"xpub","ref":"xpub6GP83vJASH1kS7dQPWXFjVHDfYajopbG8U3j8peBH67CRCnb8QmDxZJfWpbgCQNHAzCDJ4MyVYjoh7Yv9yo7PQuZ9YyktgrtD9vmeo67Y4E","label":"My ETH","bitboxapp":{"coinCode":"eth","code":"v0-55555555-eth-0"}}
{"type":"tx","ref":"eth-tx-id","label":"test eth note","bitboxapp":{"coinCode":"eth","code":"v0-55555555-eth-0"}}
{"type":"tx","ref":"erc20-tx-id","label":"test erc20 note","bitboxapp":{"coinCode":"eth-erc20-usdt","code":"v0-55555555-eth-0-eth-erc20-usdt"}}
INVALID LINE
`
	_, err := s.backend.ImportNotes([]byte(export))
	s.Require().Error(err)

	// Check that a note before the invalid line was not imported.
	btcAcct := s.backend.Accounts().lookup("v0-55555555-btc-0")
	s.Require().NotNil(btcAcct)
	s.Require().Equal("", btcAcct.Notes().TxNote("btc-tx-id"))
}

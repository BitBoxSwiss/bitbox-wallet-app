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

package arguments

import (
	"os"
	"path"

	btctypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

// Arguments models a configuration of the backend.
type Arguments struct {
	mainDirectoryPath string

	// bitbox02DirectoryPath stores the location where bitbox02 application data is stored.
	bitbox02DirectoryPath string

	// cacheDirectoryPath stores the location where application data is stored.
	cacheDirectoryPath string

	// notesDirectoryPath is the location where transaction notes (labels) are stored.
	notesDirectoryPath string

	// appConfigFilename stores the filename of the application configuration.
	appConfigFilename string

	// accountsConfigFilename stores the filename of the accounts configuration.
	accountsConfigFilename string

	// lightningConfigFilename stores the filename of the lightning configuration.
	lightningConfigFilename string

	// Testing stores whether the application is for testing only.
	testing bool

	// Testing stores whether the application is for regtest.
	regtest bool

	// devservers stores wether the app should connect to the dev servers.
	// This also applies to the Pocket and BTCDirect widget environments:
	// if devserver is true, the widgets will be loaded from the staging environment,
	// otherwise from production.
	// The devservers configuration is not persisted when switching back to production.
	devservers bool

	// gapLimits optionally forces the gap limits used in btc/ltc.
	gapLimits *btctypes.GapLimits

	// log is the logger for this context
	log *logrus.Entry
}

// NewArguments returns the given parameters as backend arguments.
func NewArguments(
	mainDirectoryPath string,
	testing bool,
	regtest bool,
	devservers bool,
	gapLimits *btctypes.GapLimits,
) *Arguments {
	if !testing && regtest {
		panic("Cannot use -regtest with -mainnet.")
	}

	bitbox02DirectoryPath := path.Join(mainDirectoryPath, "bitbox02")
	if err := os.MkdirAll(bitbox02DirectoryPath, 0700); err != nil {
		panic("Cannot create the bitbox02 directory.")
	}

	cacheDirectoryPath := path.Join(mainDirectoryPath, "cache")
	if err := os.MkdirAll(cacheDirectoryPath, 0700); err != nil {
		panic("Cannot create the cache directory.")
	}

	notesDirectoryPath := path.Join(mainDirectoryPath, "notes")
	if err := os.MkdirAll(notesDirectoryPath, 0700); err != nil {
		panic("Cannot create the notes directory.")
	}

	log := logging.Get().WithGroup("arguments")
	arguments := &Arguments{
		mainDirectoryPath:     mainDirectoryPath,
		bitbox02DirectoryPath: bitbox02DirectoryPath,

		cacheDirectoryPath:      cacheDirectoryPath,
		notesDirectoryPath:      notesDirectoryPath,
		appConfigFilename:       path.Join(mainDirectoryPath, "config.json"),
		accountsConfigFilename:  path.Join(mainDirectoryPath, "accounts.json"),
		lightningConfigFilename: path.Join(mainDirectoryPath, "lightning.json"),
		testing:                 testing,
		regtest:                 regtest,
		devservers:              devservers,
		gapLimits:               gapLimits,
		log:                     log,
	}

	log.Infof("Arguments: %+v", arguments)
	return arguments
}

// MainDirectoryPath returns the path to the main directory of the backend to store data.
// The above constructor ensures that the directory with the returned path exists.
func (arguments *Arguments) MainDirectoryPath() string {
	return arguments.mainDirectoryPath
}

// AppConfigFilename returns the path to the app config file of the backend.
func (arguments *Arguments) AppConfigFilename() string {
	return arguments.appConfigFilename
}

// AccountsConfigFilename returns the path to the accounts config file of the backend.
func (arguments *Arguments) AccountsConfigFilename() string {
	return arguments.accountsConfigFilename
}

// LightningConfigFilename returns the path to the lightning config file of the backend.
func (arguments *Arguments) LightningConfigFilename() string {
	return arguments.lightningConfigFilename
}

// BitBox02DirectoryPath returns the path where BitBox data is stored.
// The above constructor ensures that the directory with the returned path exists.
func (arguments *Arguments) BitBox02DirectoryPath() string {
	return arguments.bitbox02DirectoryPath
}

// CacheDirectoryPath returns the path to the cache directory of the backend to store caches.
// The above constructor ensures that the directory with the returned path exists.
func (arguments *Arguments) CacheDirectoryPath() string {
	return arguments.cacheDirectoryPath
}

// NotesDirectoryPath returns the path to the notes directory of the backend.
// The above constructor ensures that the directory with the returned path exists.
func (arguments *Arguments) NotesDirectoryPath() string {
	return arguments.notesDirectoryPath
}

// Testing returns whether the backend is for testing only.
func (arguments *Arguments) Testing() bool {
	return arguments.testing
}

// DevServers returns whether the backend should use the development servers.
func (arguments *Arguments) DevServers() bool {
	return arguments.devservers
}

// Regtest returns whether the backend is for regtest only.
func (arguments *Arguments) Regtest() bool {
	return arguments.regtest
}

// GapLimits returns the gap limits to be used in btc/ltc (all account types).
// This is optional, so nil is a valid return value.
func (arguments *Arguments) GapLimits() *btctypes.GapLimits {
	return arguments.gapLimits
}

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

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

// Arguments models a configuration of the backend.
type Arguments struct {
	mainDirectoryPath string

	// bitbox02DirectoryPath stores the location where bitbox02 application data is stored.
	bitbox02DirectoryPath string

	// cacheDirectoryPath stores the location where application data is stored.
	cacheDirectoryPath string

	// appConfigFilename stores the filename of the application configuration.
	appConfigFilename string

	// accountsConfigFilename stores the filename of the accounts configuration.
	accountsConfigFilename string

	// Testing stores whether the application is for testing only.
	testing bool

	// Testing stores whether the application is for regtest.
	regtest bool

	// Multisig stores whether the application is in multisig mode.
	multisig bool

	// devmode stores whether the application is in dev mode and, therefore, connects to the dev environment
	devmode bool

	// log is the logger for this context
	log *logrus.Entry
}

// NewArguments returns the given parameters as backend arguments.
func NewArguments(
	mainDirectoryPath string,
	testing bool,
	regtest bool,
	multisig bool,
	devmode bool,
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

	log := logging.Get().WithGroup("arguments")
	arguments := &Arguments{
		mainDirectoryPath:      mainDirectoryPath,
		bitbox02DirectoryPath:  bitbox02DirectoryPath,
		cacheDirectoryPath:     cacheDirectoryPath,
		appConfigFilename:      path.Join(mainDirectoryPath, "config.json"),
		accountsConfigFilename: path.Join(mainDirectoryPath, "accounts.json"),
		testing:                testing,
		regtest:                regtest,
		multisig:               multisig,
		devmode:                devmode,
		log:                    log,
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

// BitBox02DirectoryPath returns the path to the bitbox02 directory of the backend to store caches.
// The above constructor ensures that the directory with the returned path exists.
func (arguments *Arguments) BitBox02DirectoryPath() string {
	return arguments.bitbox02DirectoryPath
}

// CacheDirectoryPath returns the path to the cache directory of the backend to store caches.
// The above constructor ensures that the directory with the returned path exists.
func (arguments *Arguments) CacheDirectoryPath() string {
	return arguments.cacheDirectoryPath
}

// Testing returns whether the backend is for testing only.
func (arguments *Arguments) Testing() bool {
	return arguments.testing
}

// DevMode returns whether the backend is in developer mode.
func (arguments *Arguments) DevMode() bool {
	return arguments.devmode
}

// Regtest returns whether the backend is for regtest only.
func (arguments *Arguments) Regtest() bool {
	return arguments.regtest
}

// Multisig returns whether the backend is in multisig mode.
func (arguments *Arguments) Multisig() bool {
	return arguments.multisig
}

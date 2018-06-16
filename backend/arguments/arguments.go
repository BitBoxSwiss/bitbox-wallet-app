package arguments

import (
	"os"
	"path"

	"github.com/shiftdevices/godbb/util/logging"
	"github.com/sirupsen/logrus"
)

// Arguments models a configuration of the backend.
type Arguments struct {
	mainDirectoryPath string

	// cacheDirectoryPath stores the location where application data is stored.
	cacheDirectoryPath string

	// configFilename stores the filename of the application configuration.
	configFilename string

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

	cacheDirectoryPath := path.Join(mainDirectoryPath, "cache")
	if err := os.MkdirAll(cacheDirectoryPath, 0700); err != nil {
		panic("Cannot create the cache directory.")
	}

	log := logging.Get().WithGroup("arguments")
	arguments := &Arguments{
		mainDirectoryPath:  mainDirectoryPath,
		cacheDirectoryPath: cacheDirectoryPath,
		configFilename:     path.Join(mainDirectoryPath, "config.json"),
		testing:            testing,
		regtest:            regtest,
		multisig:           multisig,
		devmode:            devmode,
		log:                log,
	}

	log.Infof("Arguments: %+v", arguments)
	return arguments
}

// MainDirectoryPath returns the path to the main directory of the backend to store data.
// The above constructor ensures that the directory with the returned path exists.
func (arguments *Arguments) MainDirectoryPath() string {
	return arguments.mainDirectoryPath
}

// ConfigFilename returns the path to the config file of the backend.
func (arguments *Arguments) ConfigFilename() string {
	return arguments.configFilename
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

package backend

import (
	"flag"
	"os"
	"path"
)

const defaultMainDirectoryPath = "."

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
}

// NewArguments returns the given parameters as backend arguments.
func NewArguments(
	mainDirectoryPath string,
	testing bool,
	regtest bool,
	multisig bool,
) *Arguments {
	if !testing && regtest {
		panic("Cannot use -regtest with -mainnet.")
	}

	cacheDirectoryPath := path.Join(mainDirectoryPath, "cache")
	if err := os.MkdirAll(cacheDirectoryPath, 0700); err != nil {
		panic("Cannot create the cache directory.")
	}

	return &Arguments{
		mainDirectoryPath:  mainDirectoryPath,
		cacheDirectoryPath: cacheDirectoryPath,
		configFilename:     path.Join(mainDirectoryPath, "config.json"),
		testing:            testing,
		regtest:            regtest,
		multisig:           multisig,
	}
}

// ParseArguments parses the arguments from the command line.
func ParseArguments() *Arguments {
	mainnet := flag.Bool("mainnet", false, "switch to mainnet instead of testnet coins")
	regtest := flag.Bool("regtest", false, "use regtest instead of testnet coins")
	multisig := flag.Bool("multisig", false, "use the app in multisig mode")
	flag.Parse()

	return NewArguments(defaultMainDirectoryPath, !*mainnet, *regtest, *multisig)
}

// MainDirectoryPath returns the path to the main directory of the backend to store data.
// The above constructor ensures that the directory with the returned path exists.
func (arguments *Arguments) MainDirectoryPath() string {
	return arguments.mainDirectoryPath
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

// Regtest returns whether the backend is for regtest only.
func (arguments *Arguments) Regtest() bool {
	return arguments.regtest
}

// Multisig returns whether the backend is in multisig mode.
func (arguments *Arguments) Multisig() bool {
	return arguments.multisig
}

var productionArguments = NewArguments(defaultMainDirectoryPath, false, false, false)

// ProductionArguments returns the arguments used for production.
func ProductionArguments() *Arguments {
	return productionArguments
}

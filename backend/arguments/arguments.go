package arguments

import (
	"flag"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"sync"

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

// newArguments returns the given parameters as backend arguments.
func newArguments(
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

	log := logging.Log.WithGroup("arguments")
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

var instance *Arguments
var once sync.Once

// Get parses the application arguments, if not done yet, and returns them
func Get() *Arguments {
	once.Do(func() {
		instance = getProductionArguments()
	})
	return instance
}

// parseArguments parses the arguments from the command line.
func parseArguments(defaultMainnet, defaultRegTest, defaultMultiSig, defaultDevMode bool, defaultAppFolder string) *Arguments {
	mainnet := flag.Bool("mainnet", defaultMainnet, "switch to mainnet instead of testnet coins")
	regtest := flag.Bool("regtest", defaultRegTest, "use regtest instead of testnet coins")
	multisig := flag.Bool("multisig", defaultMultiSig, "use the app in multisig mode")
	devmode := flag.Bool("devmode", defaultDevMode, "switch to dev mode")
	appFolder := flag.String("appfolder", defaultAppFolder, "configure the app folder")
	flag.Parse()

	return newArguments(*appFolder, !*mainnet, *regtest, *multisig, *devmode)
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

// getAppFolder returns the production application folder.
func getAppFolder() string {
	var appFolder string
	switch runtime.GOOS {
	case "windows":
		appFolder = os.Getenv("APPDATA")
	case "darwin":
		// Usually /home/<User>/Library/Application Support
		appFolder = os.Getenv("HOME") + "/Library/Application Support"
	case "linux":
		if os.Getenv("XDG_CONFIG_HOME") != "" {
			// Usually /home/<User>/.config/
			appFolder = os.Getenv("XDG_CONFIG_HOME")
		} else {
			appFolder = filepath.Join(os.Getenv("HOME"), ".config")
		}
	}
	appFolder = path.Join(appFolder, "bitbox")
	logging.Log.WithGroup("arguments").Info("appFolder: ", appFolder)
	return appFolder
}

func getProductionArguments() *Arguments {
	defaultMainnet := true
	testnet := !*(flag.Bool("mainnet", defaultMainnet, "switch to mainnet instead of testnet coins"))
	regTest := false
	multiSig := false
	devMode := false
	appFolder := getAppFolder()
	return newArguments(appFolder, testnet, regTest, multiSig, devMode)
}

func getDevelopmentDefaults() (defaultMainnet, defaultRegTest, defaultMultiSig, defaultDevMode bool,
	defaultAppFolder string) {
	defaultMainnet = false
	defaultRegTest = false
	defaultMultiSig = false
	defaultDevMode = true
	defaultAppFolder = "."
	return
}

// InitDevEnv sets the arguments used for development.
func InitDevEnv() {
	once.Do(func() {
		instance = parseArguments(getDevelopmentDefaults())
	})
}

// InitTestEnv sets the arguments used in testing.
func InitTestEnv(testFolder string, regTest, multiSig bool) {
	// prevent overriding by backend
	once.Do(func() {})
	instance = newArguments(testFolder, true, regTest, multiSig, true)
}

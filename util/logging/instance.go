package logging

import (
	"fmt"
	"path/filepath"
	"sync"

	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/util/config"
	"github.com/shiftdevices/godbb/util/errp"
)

const (
	// configFileName stores the name of the file that contains the logging configuration.
	configFileName = "logging.json"
)

var instance *Logger
var once sync.Once

// Get returns the configured logger or a new one based on the configuration file.
func Get() *Logger {
	once.Do(func() {
		var configuration Configuration
		configFile := config.NewFile(configFileName)
		if configFile.Exists() {
			if err := configFile.ReadJSON(&configuration); err != nil {
				panic(errp.WithStack(err))
			}
			fmt.Printf("Logging configuration taken from '%s'.\n", configFile.Path())
		} else {
			configuration = Configuration{
				Output: filepath.Join(config.DirectoryPath(), "log.txt"),
				Level:  logrus.DebugLevel, // Change to InfoLevel before a release.
			}
			if err := configFile.WriteJSON(configuration); err != nil {
				panic(errp.WithStack(err))
			}
			fmt.Printf("Logging configuration written to '%s'.\n", configFile.Path())
		}
		instance = NewLogger(&configuration)
	})
	return instance
}

// Set configures the logger with the given configuration.
func Set(configuration *Configuration) {
	once.Do(func() {
		instance = NewLogger(configuration)
	})
}

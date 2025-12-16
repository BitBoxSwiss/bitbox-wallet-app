// SPDX-License-Identifier: Apache-2.0

package logging

import (
	"path/filepath"
	"sync"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/sirupsen/logrus"
)

var instance *Logger
var once sync.Once

// Get returns the configured logger or a new one based on the configuration file.
func Get() *Logger {
	once.Do(func() {
		configuration := Configuration{
			Output: filepath.Join(config.AppDir(), "log.txt"),
			Level:  logrus.DebugLevel,
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

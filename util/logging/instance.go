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

package logging

import (
	"fmt"
	"path/filepath"
	"sync"

	"github.com/sirupsen/logrus"

	"github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
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
		configFile := config.NewFile(config.AppDir(), configFileName)
		if configFile.Exists() {
			if err := configFile.ReadJSON(&configuration); err != nil {
				panic(errp.WithStack(err))
			}
			fmt.Printf("Logging configuration taken from '%s'.\n", configFile.Path())
		} else {
			configuration = Configuration{
				Output: filepath.Join(config.AppDir(), "log.txt"),
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

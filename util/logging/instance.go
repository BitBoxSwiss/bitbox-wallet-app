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

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
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// Logger adds a method to the logrus logger.
type Logger struct {
	logrus.Logger
}

// NewLogger returns a new logger based on the given configuration.
func NewLogger(configuration *Configuration) *Logger {
	var logger = Logger{}
	logger.Formatter = &logrus.TextFormatter{}
	logger.Hooks = make(logrus.LevelHooks)
	logger.AddHook(stackHook{
		stackLevels: []logrus.Level{logrus.PanicLevel, logrus.FatalLevel, logrus.ErrorLevel, logrus.WarnLevel},
	})
	if configuration.Output == "STDOUT" {
		logger.Out = os.Stdout
	} else if configuration.Output == "STDERR" {
		logger.Out = os.Stderr
	} else {
		if err := os.MkdirAll(filepath.Dir(configuration.Output), os.ModeDir|os.ModePerm); err != nil {
			panic(errp.WithStack(err))
		}
		file, err := os.OpenFile(configuration.Output, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0666)
		if err != nil {
			panic(errp.WithStack(err))
		}
		logger.Out = file
	}
	logger.Level = configuration.Level
	fmt.Printf("Logging into '%s' from '%s'.\n", configuration.Output, configuration.Level)
	return &logger
}

// WithGroup sets a trace group for the log entry.
func (logger *Logger) WithGroup(group string) *logrus.Entry {
	return logger.WithField("group", group)
}

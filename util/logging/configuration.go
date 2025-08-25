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
	"github.com/sirupsen/logrus"
)

// Configuration serializes and deserializes the logging parameters.
type Configuration struct {
	// Output location of the logger.
	// Can be either a path relative to the configuration directory, STDOUT or STDERR.
	Output string

	// Level from which on the entries are logged.
	Level logrus.Level
}

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
	"encoding/json"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/sirupsen/logrus"
)

// Configuration serializes and deserializes the logging parameters.
type Configuration struct {
	// Output location of the logger.
	// Can be either a path relative to the configuration directory, STDOUT or STDERR.
	Output string `json:"output"`

	// Level from which on the entries are logged.
	Level logrus.Level `json:"level"`
}

// MarshalJSON implements json.Marshaler.
func (configuration Configuration) MarshalJSON() ([]byte, error) {
	return json.Marshal(&map[string]string{
		"output": configuration.Output,
		"level":  configuration.Level.String(),
	})
}

// UnmarshalJSON implements json.Unmarshaler.
func (configuration *Configuration) UnmarshalJSON(bytes []byte) error {
	var encoding map[string]string
	if err := json.Unmarshal(bytes, &encoding); err != nil {
		return errp.Wrap(err, "Could not unmarshal the logging configuration.")
	}

	output, found := encoding["output"]
	if !found {
		return errp.New("The output was not found in the logging configuration.")
	}
	configuration.Output = output

	level, found := encoding["level"]
	if !found {
		return errp.New("The level was not found in the logging configuration.")
	}
	var err error
	configuration.Level, err = logrus.ParseLevel(level)
	if err != nil {
		return errp.Wrap(err, "Could not parse the level of the logging configuration.")
	}
	return nil
}

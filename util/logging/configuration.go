// SPDX-License-Identifier: Apache-2.0

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

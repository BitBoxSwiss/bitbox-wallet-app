package logging

import (
	"encoding/json"

	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/util/errp"
)

// Configuration serializes and deserializes the logging parameters.
type Configuration struct {
	// Output location of the logger.
	// Can be either a relative path to the log file, STDOUT or STDERR.
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

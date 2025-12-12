// SPDX-License-Identifier: Apache-2.0

package logging

// NewHook is the initializer for LoggingStackHook{} (implementing logrus.Hook).
import (
	"fmt"
	"maps"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

// stackHook is a logrus hook for logging stack-traces. It implements logrus.Hook.
type stackHook struct {
	stackLevels []logrus.Level
}

// Levels provides the levels to filter.
func (hook stackHook) Levels() []logrus.Level {
	return hook.stackLevels
}

func enrichIfPossible(err error, entry *logrus.Entry) {
	if errCast, ok := err.(*errp.DetailedError); ok {
		maps.Copy(entry.Data, errCast.Data)
	}
	cause := errors.Cause(err)
	if cause != nil && err != cause {
		enrichIfPossible(cause, entry)
	}
}

// Fire is called by logrus when something is logged.
func (hook stackHook) Fire(entry *logrus.Entry) error {
	err := entry.Data["error"]
	if err != nil {
		if errCast, ok := err.(error); ok {
			enrichIfPossible(errCast, entry)
			stackTrace := fmt.Sprintf("%+v", errCast)
			stackLine := strings.ReplaceAll(stackTrace, "\n", " > ")
			stackLine = strings.ReplaceAll(stackLine, "\t", "")
			entry.Data["error"] = stackLine
		}
	}
	return nil
}

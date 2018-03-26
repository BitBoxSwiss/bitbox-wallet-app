package logging

// NewHook is the initializer for LoggingStackHook{} (implementing logrus.Hook).
import (
	"fmt"
	"strings"

	"github.com/shiftdevices/godbb/util/errp"

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
		for k, v := range errCast.Data {
			entry.Data[k] = v
		}
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
			stackLine := strings.Replace(stackTrace, "\n", " > ", -1)
			stackLine = strings.Replace(stackLine, "\t", "", -1)
			entry.Data["error"] = stackLine
		}
	}
	return nil
}

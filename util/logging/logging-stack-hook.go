package logging

// NewHook is the initializer for LoggingStackHook{} (implementing logrus.Hook).
import (
	"fmt"
	"strings"

	"github.com/shiftdevices/godbb/util/errp"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

// StackHook is a logrus hook for logging stack-traces.
type StackHook struct {
	StackLevels []logrus.Level
}

// NewHook sets levels to stackLevels for which "stack" value may
// be set, providing the stack of the error, if available.
func NewHook(stackLevels []logrus.Level) StackHook {
	return StackHook{
		StackLevels: stackLevels,
	}
}

// Levels provides the levels to filter.
func (hook StackHook) Levels() []logrus.Level {
	return hook.StackLevels
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
func (hook StackHook) Fire(entry *logrus.Entry) error {
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

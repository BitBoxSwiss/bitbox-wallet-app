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

// NewHook is the initializer for LoggingStackHook{} (implementing logrus.Hook).
import (
	"fmt"
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
			stackLine := strings.ReplaceAll(stackTrace, "\n", " > ")
			stackLine = strings.ReplaceAll(stackLine, "\t", "")
			entry.Data["error"] = stackLine
		}
	}
	return nil
}

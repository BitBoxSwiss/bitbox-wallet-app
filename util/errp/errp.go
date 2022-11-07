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

// Package errp wraps the github.com/pkg/errors package, because its name clashes with the builtin
// errors package, which confuses the automatic imports tool goimports.
package errp

import (
	"github.com/pkg/errors"
)

var (
	// New wraps errors.New.
	New = errors.New
	// Newf wraps errors.Newf.
	Newf = errors.Errorf
	// WithStack wraps errors.WithStack.
	WithStack = errors.WithStack
	// Cause wraps errors.Cause.
	Cause = errors.Cause
	// Wrap wraps errors.Wrap.
	Wrap = errors.Wrap
	// Wrapf wraps errors.Wrapf.
	Wrapf = errors.Wrapf
	// WithMessage wraps errors.WithMessage.
	WithMessage = errors.WithMessage
)

// DetailedError combines an error with a map of data points that provide more context and are
// useful for logging.
type DetailedError struct {
	Data Context
	Err  error
}

// Context provides the context for a detailed error.
type Context map[string]interface{}

func (detailedError DetailedError) Error() string {
	return detailedError.Err.Error()
}

// WithContext takes an error and a data map and provides a DetailedError that combines both.
func WithContext(err error, data Context) *DetailedError {
	return &DetailedError{Data: data, Err: err}
}

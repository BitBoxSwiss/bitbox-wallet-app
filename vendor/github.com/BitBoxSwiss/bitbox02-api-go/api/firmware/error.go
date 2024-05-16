// Copyright 2018-2019 Shift Cryptosecurity AG
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

package firmware

import (
	"fmt"

	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
)

const (
	// 100 errors are reserved for errors coming from the device firmware
	// Different namespace should be used for local app errors.

	// ErrInvalidInput is returned when the request sends and invalid or unexpected input.
	ErrInvalidInput = 101

	// ErrUserAbort is returned when the user aborts an action on the device.
	ErrUserAbort = 104
)

// Error wraps an error from bitbox02.
type Error struct {
	Code    int32
	Message string
}

// NewError creates a error with the given message and code.
func NewError(code int32, message string) *Error {
	return &Error{code, message}
}

// Error implements the error interface.
func (err *Error) Error() string {
	return err.Message
}

// isErrorCode returns whether the error is a bitbox02 error with the given code.
func isErrorCode(err error, code int32) bool {
	deviceErr, ok := errp.Cause(err).(*Error)
	return ok && deviceErr.Code == code
}

// IsErrorAbort returns whether the user aborted the operation.
func IsErrorAbort(err error) bool {
	return isErrorCode(err, ErrUserAbort)
}

// UnsupportedError should wrap a version string, e.g. "9.2.0". It means a feature is not available
// before this version.
type UnsupportedError string

func (e UnsupportedError) Error() string {
	return fmt.Sprintf("This feature is supported from firmware version %s. Please upgrade your firmware.", string(e))
}

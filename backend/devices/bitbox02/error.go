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

package bitbox02

import "github.com/digitalbitbox/bitbox-wallet-app/util/errp"

const (
	// 100 errors are reserved for errors coming from the device firmware
	// Difference namespace should be used for local app errors

	// ErrInvalidInput is returned when the request sends and invalid or unexpected input
	ErrInvalidInput = 101

	// ErrMemory is returned when an an error occurs during memory handling in the commander
	ErrMemory = 102

	// ErrTouchButton TODO: currently not returned anywhere
	ErrTouchButton = 103

	// ErrSetPW is returned by SetPassword() if the two user passwords did not match.
	ErrSetPW = 104

	// ErrUserAbort is returned when the user aborts an action on the device.
	ErrUserAbort = 108
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

// isErrorAbort returns whether the user aborted the operation.
func isErrorAbort(err error) bool {
	deviceErr, ok := errp.Cause(err).(*Error)
	return ok && deviceErr.Code == ErrUserAbort
}

// SPDX-License-Identifier: Apache-2.0

package bitbox

const (
	// ErrIONoPassword is returned when no password has been configured.
	ErrIONoPassword = 101

	// ErrTouchAbort is returned when the user short-touches the button.
	ErrTouchAbort = 600

	// ErrTouchTimeout is returned when the user does not confirm or abort for 30s.
	ErrTouchTimeout = 601

	// ErrSDCard is returned when the SD card is needed, but not inserted.
	ErrSDCard = 400

	// ErrInitializing is returned when the device is still booting up.
	ErrInitializing = 503

	// ErrSDNoMatch is returned when the backup check fails.
	ErrSDNoMatch = 410

	// errSDOpenDir is returned when the digitalbitbox directory is missing on the SD card, when
	// listing the backups.
	errSDOpenDir = 403

	// ========= Below are error codes defined locally, not by the BitBox firmware.

	errPINIncorrect     = 10000
	errReplacePINFailed = 10001
)

// Error wraps an error by the bitbox.
type Error struct {
	message string
	Code    float64
}

// NewError creates a error with the given message and code.
func NewError(message string, code float64) *Error {
	return &Error{message, code}
}

// Error implements the error interface.
func (err *Error) Error() string {
	return err.message
}

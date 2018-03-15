// Package errp wraps the github.com/pkg/errors package, because its name clashes with the builtin
// errors package, which confuses the automatic imports tool goimports.
package errp

import "github.com/pkg/errors"

var (
	// New wraps errors.New
	New = errors.New
	// Newf wraps errors.Newf
	Newf = errors.Errorf
	// WithStack wraps errors.WithStack
	WithStack = errors.WithStack
	// Cause wraps errors.Cause
	Cause = errors.Cause
	// Wrap wraps errors.Wrap
	Wrap = errors.Wrap
	// WithMessage wraps errors.WithMessage
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

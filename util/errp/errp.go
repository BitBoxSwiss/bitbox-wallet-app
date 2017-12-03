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
)

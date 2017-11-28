// Package errp wraps the github.com/pkg/errors package, because its name clashes with the builtin
// errors package, which confuses the automatic imports tool goimports.
package errp

import "github.com/pkg/errors"

var (
	New       = errors.New
	Newf      = errors.Errorf
	WithStack = errors.WithStack
	Cause     = errors.Cause
)

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
	// WithMessage wraps errors.WithMessage.
	WithMessage = errors.WithMessage
)

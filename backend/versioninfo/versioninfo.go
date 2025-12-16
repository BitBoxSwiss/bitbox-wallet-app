// SPDX-License-Identifier: Apache-2.0

package versioninfo

import (
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
)

var (
	// versionString is overridden at build time via go ldflags.
	versionString = "0.0.1"
	// Version of the backend as displayed to the user.
	Version *semver.SemVer
)

func init() {
	parsed, err := semver.NewSemVerFromString(versionString)
	if err != nil {
		panic(err)
	}
	Version = parsed
}

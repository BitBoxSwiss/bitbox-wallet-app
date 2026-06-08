// SPDX-License-Identifier: Apache-2.0

package semver

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
)

// SemVer implements Semantic Versioning according to https://semver.org.
type SemVer struct {
	major uint16
	minor uint16
	patch uint16
}

// NewSemVer creates a new SemVer from the given major, minor and patch versions.
func NewSemVer(major uint16, minor uint16, patch uint16) *SemVer {
	return &SemVer{major, minor, patch}
}

// NewSemVerFromString creates a new SemVer from the given version string and returns an error on
// failure.
func NewSemVerFromString(versionString string) (*SemVer, error) {
	versionString = strings.TrimPrefix(versionString, "v")
	splits := strings.Split(versionString, ".")
	if len(splits) != 3 {
		return nil, errp.New("The version format has to be 'major.minor.patch'.")
	}

	major, err := strconv.Atoi(splits[0])
	if err != nil {
		return nil, errp.Wrap(err, "The major version is not a number.")
	}

	minor, err := strconv.Atoi(splits[1])
	if err != nil {
		return nil, errp.Wrap(err, "The minor version is not a number.")
	}

	patch, err := strconv.Atoi(splits[2])
	if err != nil {
		return nil, errp.Wrap(err, "The patch version is not a number.")
	}

	return &SemVer{major: uint16(major), minor: uint16(minor), patch: uint16(patch)}, nil
}

// AtLeast checks whether this version is equal to or higher than fromVersion.
func (version *SemVer) AtLeast(fromVersion *SemVer) bool {
	if version.major < fromVersion.major {
		return false
	}
	if version.major == fromVersion.major && version.minor < fromVersion.minor {
		return false
	}
	if version.major == fromVersion.major && version.minor == fromVersion.minor && version.patch < fromVersion.patch {
		return false
	}
	return true
}

func (version *SemVer) String() string {
	return fmt.Sprintf("%d.%d.%d", version.major, version.minor, version.patch)
}

// MarshalJSON implements json.Marshaler.
func (version *SemVer) MarshalJSON() ([]byte, error) {
	return json.Marshal(version.String())
}

// UnmarshalJSON implements json.Unmarshaler.
func (version *SemVer) UnmarshalJSON(bytes []byte) error {
	var input string
	if err := json.Unmarshal(bytes, &input); err != nil {
		return errp.Wrap(err, "Could not unmarshal a semantic version.")
	}
	decoded, err := NewSemVerFromString(input)
	if err != nil {
		return err
	}
	*version = *decoded
	return nil
}

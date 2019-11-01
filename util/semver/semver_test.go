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

package semver_test

import (
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/stretchr/testify/assert"
)

func TestNewSemVer(t *testing.T) {
	if version, err := semver.NewSemVerFromString("3.2.4"); assert.Nil(t, err) {
		assert.Equal(t, semver.NewSemVer(3, 2, 4), version)
	}

	var err error

	_, err = semver.NewSemVerFromString("3.2")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.2.")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.2.A")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.2.4-")
	assert.Error(t, err)
}

func TestAtLeast(t *testing.T) {
	fromVersion := semver.NewSemVer(3, 2, 4)

	assert.True(t, semver.NewSemVer(3, 2, 4).AtLeast(fromVersion))
	assert.False(t, semver.NewSemVer(3, 2, 3).AtLeast(fromVersion))
}

func TestString(t *testing.T) {
	assert.Equal(t, "3.2.4", semver.NewSemVer(3, 2, 4).String())
}

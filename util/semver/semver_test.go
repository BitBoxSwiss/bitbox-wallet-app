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
	"encoding/json"
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSemVer(t *testing.T) {
	version, err := semver.NewSemVerFromString("3.2.4")
	require.NoError(t, err)
	assert.Equal(t, semver.NewSemVer(3, 2, 4), version)

	version, err = semver.NewSemVerFromString("v3.2.4")
	require.NoError(t, err)
	assert.Equal(t, semver.NewSemVer(3, 2, 4), version)

	_, err = semver.NewSemVerFromString("")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("vv3.2.4")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.2")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("v3.2")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.2.")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.2.A")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.A.4")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.2.4-")
	assert.Error(t, err)
}

func TestAtLeast(t *testing.T) {
	fromVersion := semver.NewSemVer(3, 2, 4)

	assert.True(t, semver.NewSemVer(3, 2, 4).AtLeast(fromVersion))
	assert.False(t, semver.NewSemVer(3, 2, 3).AtLeast(fromVersion))
	assert.False(t, semver.NewSemVer(2, 2, 5).AtLeast(fromVersion))
	assert.False(t, semver.NewSemVer(3, 1, 5).AtLeast(fromVersion))
}

func TestString(t *testing.T) {
	assert.Equal(t, "3.2.4", semver.NewSemVer(3, 2, 4).String())
}

func TestJSON(t *testing.T) {
	jsonBytes, err := json.Marshal(semver.NewSemVer(3, 2, 4))
	require.NoError(t, err)
	require.Equal(t, string(jsonBytes), `"3.2.4"`)

	var version semver.SemVer
	require.Error(t, json.Unmarshal([]byte(`123`), &version))
	require.Error(t, json.Unmarshal([]byte(`"3.A.4"`), &version))

	require.NoError(t, json.Unmarshal([]byte(`"3.2.4"`), &version))
	require.Equal(t, &version, semver.NewSemVer(3, 2, 4))
}

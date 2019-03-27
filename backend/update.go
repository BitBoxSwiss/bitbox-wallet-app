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

package backend

import (
	"encoding/json"
	"net/http"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
)

const updateFileURL = "https://shiftcrypto.ch/updates/desktop.json"

var (
	// Version of the backend as displayed to the user.
	Version = semver.NewSemVer(4, 6, 0)
)

// UpdateFile is retrieved from the server.
type UpdateFile struct {
	// CurrentVersion stores the current version and is not loaded from the server.
	CurrentVersion *semver.SemVer `json:"current"`

	// NewVersion stores the new version and may not be nil.
	NewVersion *semver.SemVer `json:"version"`

	// Description gives additional information on the release.
	Description string `json:"description"`
}

// CheckForUpdate checks whether a newer version of this application has been released.
// It returns the retrieved update file if a newer version has been released and nil otherwise.
func CheckForUpdate() (*UpdateFile, error) {
	response, err := http.Get(updateFileURL)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	defer func() {
		_ = response.Body.Close()
	}()

	var updateFile UpdateFile
	err = json.NewDecoder(response.Body).Decode(&updateFile)
	if err != nil {
		return nil, errp.WithStack(err)
	}

	if Version.AtLeast(updateFile.NewVersion) {
		return nil, nil
	}

	updateFile.CurrentVersion = Version
	return &updateFile, nil
}

// CheckForUpdateIgnoringErrors suppresses any errors that are triggered, for example, when offline.
func CheckForUpdateIgnoringErrors() *UpdateFile {
	updateFile, err := CheckForUpdate()
	if err != nil {
		logging.Get().WithGroup("update").WithError(err).Warn("Check for update failed.")
		return nil
	}
	return updateFile
}

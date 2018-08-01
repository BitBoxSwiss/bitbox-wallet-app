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

	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/semver"
)

const updateFileURL = "https://shiftcrypto.ch/updates/desktop.json"

var (
	// Version of the backend as displayed to the user.
	Version = semver.NewSemVer(4, 0, 0)
)

// The update file is retrieved from the server.
type updateFile struct {
	// CurrentVersion stores the current version and is not loaded from the server.
	CurrentVersion *semver.SemVer `json:"current"`

	// NewVersion stores the new version and may not be nil.
	NewVersion *semver.SemVer `json:"version"`

	// Description gives additional information on the release.
	Description string `json:"description"`
}

type updateEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// CheckForUpdate checks whether a newer version of this application has been released.
func (backend *Backend) checkForUpdate() error {
	response, err := http.Get(updateFileURL)
	if err != nil {
		return errp.WithStack(err)
	}
	defer func() {
		_ = response.Body.Close()
	}()

	var update updateFile
	err = json.NewDecoder(response.Body).Decode(&update)
	if err != nil {
		return errp.WithStack(err)
	}

	if *update.NewVersion != *Version {
		update.CurrentVersion = Version
		backend.events <- updateEvent{Type: "update", Data: update}
	}

	return nil
}

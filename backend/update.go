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
	Version = semver.NewSemVer(0, 1, 0)
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
	defer response.Body.Close()

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

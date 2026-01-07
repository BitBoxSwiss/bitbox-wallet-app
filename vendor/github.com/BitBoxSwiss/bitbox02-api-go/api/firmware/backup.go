// SPDX-License-Identifier: Apache-2.0

package firmware

import (
	"time"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
)

// CreateBackup is called after SetPassword() to create the backup.
func (device *Device) CreateBackup() error {
	if device.status != StatusSeeded && device.status != StatusInitialized {
		return errp.New("invalid status")
	}

	now := time.Now()
	_, offset := now.Zone()

	request := &messages.Request{
		Request: &messages.Request_CreateBackup{
			CreateBackup: &messages.CreateBackupRequest{
				Timestamp:      uint32(now.Unix()),
				TimezoneOffset: int32(offset),
			},
		},
	}

	response, err := device.query(request)
	if err != nil {
		return err
	}

	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	if device.status == StatusSeeded {
		device.changeStatus(StatusInitialized)
	}
	return nil
}

// Backup contains the metadata of one backup.
type Backup struct {
	ID   string
	Name string
	Time time.Time
}

// ListBackups returns a list of all backups on the SD card.
func (device *Device) ListBackups() ([]*Backup, error) {
	request := &messages.Request{
		Request: &messages.Request_ListBackups{
			ListBackups: &messages.ListBackupsRequest{},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return nil, err
	}
	listBackupsResponse, ok := response.Response.(*messages.Response_ListBackups)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	msgBackups := listBackupsResponse.ListBackups.Info
	backups := make([]*Backup, len(msgBackups))
	for index, msgBackup := range msgBackups {
		backups[index] = &Backup{
			ID:   msgBackup.Id,
			Name: msgBackup.Name,
			Time: time.Unix(int64(msgBackup.Timestamp), 0).Local(),
		}
	}
	return backups, nil
}

// CheckBackup checks if any backup on the SD card matches the current seed on the device
// and returns the name and ID of the matching backup.
func (device *Device) CheckBackup(silent bool) (string, error) {
	request := &messages.Request{
		Request: &messages.Request_CheckBackup{
			CheckBackup: &messages.CheckBackupRequest{
				Silent: silent,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return "", err
	}
	backup, ok := response.Response.(*messages.Response_CheckBackup)
	if !ok {
		return "", errp.New("unexpected response")
	}
	return backup.CheckBackup.Id, nil
}

// RestoreBackup restores a backup returned by ListBackups (id).
func (device *Device) RestoreBackup(id string) error {
	now := time.Now()
	_, offset := now.Zone()
	request := &messages.Request{
		Request: &messages.Request_RestoreBackup{
			RestoreBackup: &messages.RestoreBackupRequest{
				Id:             id,
				Timestamp:      uint32(now.Unix()),
				TimezoneOffset: int32(offset),
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.Response_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	device.changeStatus(StatusInitialized)
	return nil
}

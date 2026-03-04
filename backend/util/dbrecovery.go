// SPDX-License-Identifier: Apache-2.0

package util

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/sirupsen/logrus"
)

// QuarantineCorruptDBFile moves a corrupted DB file aside so a fresh DB can be created.
func QuarantineCorruptDBFile(
	filename string,
	openErr error,
	log *logrus.Entry,
	dbName string,
) (bool, error) {
	fileInfo, err := os.Stat(filename)
	if errors.Is(err, os.ErrNotExist) {
		return false, openErr
	}
	if err != nil {
		return false, err
	}
	if fileInfo.IsDir() {
		return false, fmt.Errorf("%s is a directory", filename)
	}

	backupFilename := fmt.Sprintf("%s.corrupt.%d", filename, time.Now().UTC().UnixNano())
	if err := os.Rename(filename, backupFilename); err != nil {
		return false, err
	}
	log.WithError(openErr).
		WithFields(logrus.Fields{"source": filename, "backup": backupFilename}).
		Warnf("%s appears corrupted, moved aside and recreating", dbName)
	return true, nil
}

// RemoveCorruptDBFile removes a corrupted DB file so the caller can recreate it from scratch.
func RemoveCorruptDBFile(
	filename string,
	openErr error,
	log *logrus.Entry,
	dbName string,
) (bool, error) {
	fileInfo, err := os.Stat(filename)
	if errors.Is(err, os.ErrNotExist) {
		return false, openErr
	}
	if err != nil {
		return false, err
	}
	if fileInfo.IsDir() {
		return false, fmt.Errorf("%s is a directory", filename)
	}

	if err := os.Remove(filename); err != nil {
		return false, err
	}
	log.WithError(openErr).Warnf("%s appears corrupted, removing file before recreation", dbName)
	return true, nil
}

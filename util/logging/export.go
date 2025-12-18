// SPDX-License-Identifier: Apache-2.0

package logging

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// WriteCombinedLog writes the current log file and, if it exists, the rotated-out log file
// (with ".1" appended) into dst, in chronological order (rotated file first).
func WriteCombinedLog(dst io.Writer, logFilePath string) error {
	paths := []string{}

	rotatedLogFilePath := logFilePath + rotatedSuffix
	if _, err := os.Stat(rotatedLogFilePath); err == nil {
		paths = append(paths, rotatedLogFilePath)
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	if _, err := os.Stat(logFilePath); err == nil {
		paths = append(paths, logFilePath)
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	if len(paths) == 0 {
		return fmt.Errorf("no log files found at %s", logFilePath)
	}

	for idx, path := range paths {
		if idx > 0 {
			if _, err := io.WriteString(dst, "\n\n"); err != nil {
				return err
			}
		}
		if _, err := io.WriteString(dst, fmt.Sprintf("----- %s -----\n", filepath.Base(path))); err != nil {
			return err
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(dst, file)
		closeErr := file.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
	}
	return nil
}

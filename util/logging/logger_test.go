// Copyright 2021 Shift Crypto AG
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

package logging

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The parent/child process tests here are to make sure they are deterministic
// thanks to:
// 1. All log file descriptors are closed and buffers are flushed at child
//    process exit.
// 2. The maxLogFileSizeBytes and other package variables are set only
//    within the child branch to not affect any other test in the same testing
//    binary.

func TestNewLogger(t *testing.T) {
	// If the env var is set, we're in the child process.
	if logfile := os.Getenv("BITBOX_TEST_APP_LOGFILE"); logfile != "" {
		maxLogFileSizeBytes = 20
		done := make(chan struct{})
		testDidTruncateHead = func() { close(done) }

		// Since the existing log file created in the parent process below
		// already exceeds maxLogFileSizeBytes, expect NewLogger to immediately
		// rotate and truncate the log file.
		logger := NewLogger(&Configuration{Output: logfile, Level: logrus.InfoLevel})
		logger.Formatter.(*logrus.TextFormatter).DisableTimestamp = true
		logger.Println("new")

		select {
		case <-time.After(2 * time.Second):
			t.Fatal("took too long to truncate old file")
		case <-done:
			// ok
		}
		return
	}

	// A dir where testing log files are stored.
	tempdir, err := os.MkdirTemp("", "logger_test")
	require.NoError(t, err, "temp dir")
	defer os.RemoveAll(tempdir)

	// Prep the data: existing file is still smaller than the maxLogFileSizeBytes
	// but a new sufficiently large message should trigger log file rotation.
	logfile := filepath.Join(tempdir, "log.txt")
	v := []byte("0123456789012345678901234") // 25 bytes > maxLogFileSizeBytes
	require.NoError(t, os.WriteFile(logfile, v, 0644), "write log.txt")

	// Execute the child process where the actual rotation and truncation happens.
	cmd := exec.Command(os.Args[0], "-test.run=TestNewLogger", "-test.v=true")
	cmd.Env = []string{fmt.Sprintf("BITBOX_TEST_APP_LOGFILE=%s", logfile)}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	require.NoError(t, cmd.Run(), "cmd.Run")

	// Expect the rotate log file to also be truncated to
	// maxLogFileSizeBytes - 25 = last 20 bytes.
	b1, _ := os.ReadFile(logfile + rotatedSuffix)
	assert.Equal(t, "56789012345678901234", string(b1), "old truncated logfile")
	b2, _ := os.ReadFile(logfile)
	assert.Equal(t, "level=info msg=new\n", string(b2), "new logfile")
}

func TestLoggerRotatingWriter(t *testing.T) {
	// If the env var is set, we're in the child process.
	if logfile := os.Getenv("BITBOX_TEST_APP_LOGFILE"); logfile != "" {
		maxLogFileSizeBytes = 20
		logger := NewLogger(&Configuration{Output: logfile, Level: logrus.InfoLevel})
		logger.Formatter.(*logrus.TextFormatter).DisableTimestamp = true
		logger.Println("newfile")
		return
	}

	// A dir where testing log files are stored.
	tempdir, err := os.MkdirTemp("", "logger_test")
	require.NoError(t, err, "temp dir")
	defer os.RemoveAll(tempdir)

	// Prep the data: existing file is still smaller than the maxLogFileSizeBytes
	// but a new sufficiently large message should trigger log file rotation.
	logfile := filepath.Join(tempdir, "log.txt")
	v := []byte("0123456789") // 10 bytes < maxLogFileSizeBytes
	require.NoError(t, os.WriteFile(logfile, v, 0644), "write log.txt")

	// Execute the child process which actually logs a new message.
	cmd := exec.Command(os.Args[0], "-test.run=TestLoggerRotatingWriter", "-test.v=true")
	cmd.Env = []string{fmt.Sprintf("BITBOX_TEST_APP_LOGFILE=%s", logfile)}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	require.NoError(t, cmd.Run(), "cmd.Run")

	// Expect the logger to rotate the file since the total size exceeds
	// maxLogFileSizeBytes.
	b1, _ := os.ReadFile(logfile + rotatedSuffix)
	assert.Equal(t, "0123456789", string(b1), "rotated logfile")
	b2, _ := os.ReadFile(logfile)
	assert.Equal(t, "level=info msg=newfile\n", string(b2), "new logfile")
}

// SPDX-License-Identifier: Apache-2.0

package logging

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"

	"github.com/sirupsen/logrus"
)

// How many bytes before rotating the log file.
// Note that rotation preserves the old file. The total size occupied
// by the log files on disk is thus capped at double this value.
//
// It is a pkg var instead of a const for easier testing.
var maxLogFileSizeBytes int64 = 1 << 24 // ~16Mb
// A commonly used suffix for rotated log files.
const rotatedSuffix = ".1"

// Logger adds a method to the logrus logger.
type Logger struct {
	logrus.Logger
}

// NewLogger returns a new logger based on the given configuration.
// It is unsafe for concurrent use because NewLogger may rotate and truncate
// an existing log file if it's too big.
func NewLogger(configuration *Configuration) *Logger {
	fmt.Printf("Logging into '%s' from '%s'.\n", configuration.Output, configuration.Level)
	var logger = Logger{}
	logger.Formatter = &logrus.TextFormatter{}
	logger.Hooks = make(logrus.LevelHooks)
	logger.AddHook(stackHook{
		stackLevels: []logrus.Level{logrus.PanicLevel, logrus.FatalLevel, logrus.ErrorLevel, logrus.WarnLevel},
	})
	switch configuration.Output {
	case "STDOUT":
		logger.Out = os.Stdout
	case "STDERR":
		logger.Out = os.Stderr
	default:
		if err := os.MkdirAll(filepath.Dir(configuration.Output), os.ModeDir|os.ModePerm); err != nil {
			fmt.Fprintf(os.Stderr, "Can't create log dir: %v; logging to stderr.\n", err)
			logger.Out = os.Stderr
			break
		}
		rotWriter, err := openRotatingWriter(configuration.Output)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Can't open log file: %v; logging to stderr.\n", err)
			logger.Out = os.Stderr
			break
		}
		logger.Out = rotWriter
	}
	logger.Level = configuration.Level
	logger.SetNoLock() // rotatingWriter already employs a writer mutex
	return &logger
}

// WithGroup sets a trace group for the log entry.
func (logger *Logger) WithGroup(group string) *logrus.Entry {
	return logger.WithField("group", group)
}

// openRotatingWriter creates a new rotatingWrite which writes log messages
// to the named file.
// It also rotates and truncates head of the log file before returning
// if the existing file size exceeds maxLogFileSizeBytes.
func openRotatingWriter(name string) (*rotatingWriter, error) {
	file, err := os.OpenFile(name, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return nil, err
	}
	// In earlier app versions, log file didn't have a size limit.
	// If this is the case and the old log file is too big, keep only the last bytes.
	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}
	size := stat.Size()
	if size > maxLogFileSizeBytes {
		newfile, oldname, err := rotate(file)
		if err != nil {
			return nil, err
		}
		go func() {
			if err := truncateHead(oldname); err != nil {
				fmt.Fprintf(os.Stderr, "Unable to truncate old logfile: %v.\n", err)
			}
			testDidTruncateHead()
		}()
		file = newfile
		size = 0
	}
	return &rotatingWriter{logfile: file, bytesCount: size}, nil
}

// A test callback once truncateHead returned.
var testDidTruncateHead = func() {}

// rotatingWriter is an io.Writer which rotates the logfile once its size
// exceeds maxLogFileSizeBytes.
// The rotated file is moved to a new name with rotatedSuffix, replacing
// an existing file, if any.
type rotatingWriter struct {
	mu         sync.Mutex
	logfile    *os.File
	bytesCount int64
}

// Write satisfies io.Writer interface.
// It rotates rot.logfile if its size plus len(p) exceeds maxLogFileSizeBytes.
func (rot *rotatingWriter) Write(p []byte) (n int, err error) {
	rot.mu.Lock()
	defer rot.mu.Unlock()
	newbytes := int64(len(p))
	if rot.bytesCount+newbytes > maxLogFileSizeBytes {
		f, _, err := rotate(rot.logfile)
		if err != nil {
			return 0, err
		}
		rot.logfile = f
		rot.bytesCount = 0
	}
	rot.bytesCount += newbytes
	return rot.logfile.Write(p)
}

// rotate moves logfile to a new name with rotatedSuffix, returning its name
// under oldname, and opens a new file at logfile.Name().
func rotate(logfile *os.File) (newfile *os.File, oldname string, err error) {
	if err := logfile.Close(); err != nil {
		return nil, "", err
	}
	filename := logfile.Name()
	rotated := filename + rotatedSuffix
	if err := os.Rename(filename, rotated); err != nil {
		return nil, "", err
	}
	f, err := os.OpenFile(filename, os.O_CREATE|os.O_TRUNC|os.O_WRONLY|os.O_APPEND, 0600)
	return f, rotated, err
}

// truncateHead keeps the last maxLogFileSizeBytes in the filename log file.
// This serves as a migration for older app versions where log file size
// was unlimited.
func truncateHead(filename string) error {
	logfile, err := os.Open(filename)
	if err != nil {
		return err
	}
	if _, err := logfile.Seek(-maxLogFileSizeBytes, io.SeekEnd); err != nil {
		return err
	}
	tempfile, err := os.OpenFile(filename+".tmp", os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer os.Remove(tempfile.Name()) //nolint:errcheck // clean up in case of a failure
	if _, err := io.Copy(tempfile, logfile); err != nil {
		return err
	}
	if err := tempfile.Close(); err != nil {
		return err
	}
	logfile.Close() //nolint:errcheck // don't care about err; will be overwritten anyway
	return os.Rename(tempfile.Name(), logfile.Name())
}

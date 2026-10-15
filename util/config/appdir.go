// SPDX-License-Identifier: Apache-2.0

package config

import (
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

var mu sync.RWMutex
var appFolder string

const (
	// PrivateDirMode is used for directories containing app-private data.
	PrivateDirMode os.FileMode = 0700
	// PrivateFileMode is used for files containing app-private data.
	PrivateFileMode os.FileMode = 0600
)

// SetAppDir sets the app folder (retrieved by AppDir()) and can only be called once.
func SetAppDir(folder string) {
	mu.Lock()
	defer mu.Unlock()
	if appFolder != "" {
		panic("app folder already set")
	}
	appFolder = folder
}

func defaultAppFolder() string {
	var folder string
	switch runtime.GOOS {
	case "darwin":
		// Usually /Users/$USER/Library/Application Support.
		folder = os.Getenv("HOME") + "/Library/Application Support"
	case "windows":
		folder = os.Getenv("APPDATA")
	case "linux":
		// Previously, we always used $HOME/.config/bitbox to store paired channel data.
		// Because XDG_CONFIG_HOME is preferred over HOME env var in default setup,
		// existing users may suffer if they loose existing pairing channel info,
		// especially when 2FA is enabled, requiring full device reset.
		// So, check for the existing dir first. If that fails, use the regular approach.
		// For most users, it is a noop.
		// See https://github.com/BitBoxSwiss/bitbox-wallet-app/pull/16 for more details.
		folder = filepath.Join(os.Getenv("HOME"), ".config")
		if fi, err := os.Stat(folder + "/bitbox"); err == nil && fi.IsDir() {
			break
		}
		// Usually /home/$USER/.config.
		folder = os.Getenv("XDG_CONFIG_HOME")
		if folder == "" {
			folder = filepath.Join(os.Getenv("HOME"), ".config")
		}
	}
	folder = filepath.Join(folder, "bitbox")
	return folder
}

// AppDir returns the absolute path to the default BitBox desktop app directory
// in the user standard config location.
func AppDir() string {
	mu.RLock()
	folder := appFolder
	mu.RUnlock()
	if folder != "" {
		return folder
	}
	mu.Lock()
	appFolder = defaultAppFolder()
	mu.Unlock()
	return appFolder
}

// EnsurePrivateDir creates dir if needed and tightens permissions if it already exists.
func EnsurePrivateDir(dir string) error {
	if err := os.MkdirAll(dir, PrivateDirMode); err != nil {
		return errp.WithStack(err)
	}
	info, err := os.Lstat(dir)
	if err != nil {
		return errp.WithStack(err)
	}
	// Ignore symlinks. The app does not create symlinks, so if it is a symlink, the user has a
	// special setup we should not interfere with.
	if info.Mode()&os.ModeSymlink != 0 {
		return nil
	}
	if !info.IsDir() {
		return errp.Newf("%s is not a directory", dir)
	}
	if info.Mode().Perm() == PrivateDirMode {
		return nil
	}
	return errp.WithStack(os.Chmod(dir, PrivateDirMode))
}

// EnsurePrivateFile tightens permissions if filename already exists with a broader mode.
func EnsurePrivateFile(filename string) error {
	return ensurePrivateFile(filename, false)
}

// EnsurePrivateFileIfExists tightens permissions if filename exists with a broader mode.
func EnsurePrivateFileIfExists(filename string) error {
	return ensurePrivateFile(filename, true)
}

func ensurePrivateFile(filename string, ignoreMissing bool) error {
	info, err := os.Lstat(filename)
	if ignoreMissing && os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return errp.WithStack(err)
	}
	// Ignore symlinks. The app does not create symlinks, so if it is a symlink, the user has a
	// special setup we should not interfere with.
	if info.Mode()&os.ModeSymlink != 0 {
		return nil
	}
	if info.IsDir() {
		return errp.Newf("%s is a directory", filename)
	}
	if info.Mode().Perm() == PrivateFileMode {
		return nil
	}
	return errp.WithStack(os.Chmod(filename, PrivateFileMode))
}

// ExportsDir returns the absolute path to the folder which can be used to export files.
func ExportsDir() (string, error) {
	if runtime.GOOS == "android" || runtime.GOOS == "ios" {
		// Android/iOS apps are sandboxed, we don't need to specify a folder.
		return "", nil
	}
	homeFolder := os.Getenv("HOME")
	if runtime.GOOS == "windows" && homeFolder == "" {
		homeFolder = os.Getenv("USERPROFILE")
	}
	if homeFolder == "" {
		return "", errp.New("can't find home directory")
	}
	return filepath.Join(homeFolder, "Downloads"), nil
}

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

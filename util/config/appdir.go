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

package config

import (
	"os"
	"path/filepath"
	"runtime"
)

// appFolder is what AppDir always returns. It is initialized only once
// in the init func.
//
// Also useful to replace with a temp dir in tests.
var appFolder string

func init() {
	switch runtime.GOOS {
	case "darwin":
		// Usually /Users/$USER/Library/Application Support.
		appFolder = os.Getenv("HOME") + "/Library/Application Support"
	case "windows":
		appFolder = os.Getenv("APPDATA")
	case "linux":
		// Previously, we always used $HOME/.config/bitbox to store paired channel data.
		// Because XDG_CONFIG_HOME is preferred over HOME env var in default setup,
		// existing users may suffer if they loose existing pairing channel info,
		// especially when 2FA is enabled, requiring full device reset.
		// So, check for the existing dir first. If that fails, use the regular approach.
		// For most users, it is a noop.
		// See https://github.com/digitalbitbox/bitbox-wallet-app/pull/16 for more details.
		appFolder = filepath.Join(os.Getenv("HOME"), ".config")
		if fi, err := os.Stat(appFolder + "/bitbox"); err == nil && fi.IsDir() {
			break
		}
		// Usually /home/$USER/.config.
		appFolder = os.Getenv("XDG_CONFIG_HOME")
		if appFolder == "" {
			appFolder = filepath.Join(os.Getenv("HOME"), ".config")
		}
	}
	appFolder = filepath.Join(appFolder, "bitbox")
}

// AppDir returns the absolute path to the default BitBox desktop app directory
// in the user standard config location.
func AppDir() string {
	return appFolder
}

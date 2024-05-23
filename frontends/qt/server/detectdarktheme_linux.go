// Copyright 2023 Shift Crypto AG
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

//go:build linux
// +build linux

package main

import (
	"os"
	"os/exec"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
)

func detectDarkTheme() bool {
	log := logging.Get().WithGroup("server")
	// Try KDE first, since Kubuntu can also have `gsettings` and that can lead to wrong results
	cmd := exec.Command("kreadconfig5", "--file", os.ExpandEnv("$HOME/.config/kdeglobals"), "--group", "General", "--key", "ColorScheme")
	out, err := cmd.Output()
	if err == nil {
		log.Info("kde theme: " + string(out))
		if matchDarkTheme(string(out)) {
			return true
		}
	}

	// Try Gnome/Ubuntu
	cmd = exec.Command("gsettings", "get", "org.gnome.desktop.interface", "color-scheme")
	out, err = cmd.Output()
	if err == nil {
		log.Info("Gnome/Ubuntu theme: " + string(out))
		if matchDarkTheme(string(out)) {
			return true
		}
	}

	// Try Cinnamon
	cmd = exec.Command("gsettings", "get", "org.cinnamon.desktop.interface", "gtk-theme")
	out, err = cmd.Output()
	if err == nil {
		log.Info("Cinnamon theme: " + string(out))
		if matchDarkTheme(string(out)) {
			return true
		}
	}

	// Try XFCE4
	cmd = exec.Command("xfconf-query", "-c", "xsettings", "-p", "/Net/ThemeName")
	out, err = cmd.Output()
	if err == nil {
		log.Info("xfce theme: " + string(out))
		if matchDarkTheme(string(out)) {
			return true
		}
	}
	return false
}

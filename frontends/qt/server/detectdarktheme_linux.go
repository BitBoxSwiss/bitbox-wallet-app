// SPDX-License-Identifier: Apache-2.0

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

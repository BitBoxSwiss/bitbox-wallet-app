// SPDX-License-Identifier: Apache-2.0

//go:build windows
// +build windows

package main

import (
	"os/exec"
	"strings"
	"syscall"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
)

// detect theme used by OS and return true if it's dark
func detectDarkTheme() bool {
	log := logging.Get().WithGroup("server")
	const regKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`
	const regName = `AppsUseLightTheme`
	cmd := exec.Command("reg", "query", regKey, "/v", regName)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.Output()
	if err == nil {
		log.Info("windows theme: " + string(out))
		if strings.Contains(string(out), "0x0") {
			return true
		}
	}
	return false
}

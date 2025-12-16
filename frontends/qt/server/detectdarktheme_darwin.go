// SPDX-License-Identifier: Apache-2.0

//go:build darwin
// +build darwin

package main

import (
	"os/exec"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
)

// detect theme used by OS and return true if it's dark
func detectDarkTheme() bool {
	log := logging.Get().WithGroup("server")
	cmd := exec.Command("defaults", "read", "-g", "AppleInterfaceStyle")
	out, err := cmd.Output()
	if err == nil {
		log.Info("MacOS theme: " + string(out))
		if strings.TrimSpace(string(out)) == "Dark" {
			return true
		}
	}
	return false
}

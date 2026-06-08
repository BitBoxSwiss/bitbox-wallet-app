// SPDX-License-Identifier: Apache-2.0

//go:build android

package mobileserver

import (
	"os/exec"
	"strings"
	"time"
)

// fixTimezone sets the local timezone on Android. This is a workaround to the bug that on Android,
// time.Local is hard-coded to UTC. See https://github.com/golang/go/issues/20455.
//
// We need the correct timezone to be able to send the `time.Now().Zone()` offset to the BitBox02.
// Without it, the BitBox02 will always display UTC time instad of local time.
//
// This fix is copied from https://github.com/golang/go/issues/20455#issuecomment-342287698.
func fixTimezone() {
	out, err := exec.Command("/system/bin/getprop", "persist.sys.timezone").Output()
	if err != nil {
		return
	}
	z, err := time.LoadLocation(strings.TrimSpace(string(out)))
	if err != nil {
		return
	}
	time.Local = z
}

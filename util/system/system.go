// SPDX-License-Identifier: Apache-2.0

package system

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// Open opens the given URL in the default browser of the user.
func Open(url string) error {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
	case "windows":
		cmd = filepath.Join(os.Getenv("SYSTEMROOT"), "System32", "rundll32.exe")
		args = []string{"url.dll,FileProtocolHandler"}
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = "xdg-open"
	}
	args = append(args, url)
	return exec.Command(cmd, args...).Start() // #nosec G204
}

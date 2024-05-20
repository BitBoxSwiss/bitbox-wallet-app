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

package config_test

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
)

// TestAppDir runs itself in a child process for each test case.
// It sets up HOME and XDG_CONFIG_HOME env variables, passing the expected
// result in BITBOX_TEST_APP_DIR.
//
// If a test in a child process fails, it exits with a non-0 code
// which makes the actual TestAppDir test fail.
func TestAppDir(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("makes sense only on linux")
	}

	// If idx is non-empty, we're in the child process test.
	idx := os.Getenv("BITBOX_TEST_APP_DIR_IDX")
	if idx != "" {
		wantAppDir := os.Getenv("BITBOX_TEST_APP_DIR")
		if dir := config.AppDir(); dir != wantAppDir {
			t.Errorf("%s: AppDir: %q; want %q", idx, dir, wantAppDir)
		}
		return
	}

	// Parent process.
	// Prepare an existing temp home dir and run child process tests.
	homeDir := test.TstTempDir("test_app_dir")
	defer func() { _ = os.RemoveAll(homeDir) }()
	legacyConfigDir := homeDir + "/.config/bitbox"
	if err := os.MkdirAll(legacyConfigDir, 0750); err != nil {
		t.Fatalf("os.MkdirAll: %v", err)
	}

	tt := []struct{ home, xdg, wantDir string }{
		{homeDir, "", legacyConfigDir},
		{homeDir, "/xdg-config", legacyConfigDir},
		{"/any-home", "/xdg-config", "/xdg-config/bitbox"},
		{"/any-home", "", "/any-home/.config/bitbox"},
		{"", "", ".config/bitbox"},
	}
	var failed bool
	for i, test := range tt {
		// The -test.run argument must match this test function name.
		cmd := exec.Command(os.Args[0], "-test.run=TestAppDir", "-test.v=true") // #nosec G204
		cmd.Env = []string{
			fmt.Sprintf("HOME=%s", test.home),
			fmt.Sprintf("XDG_CONFIG_HOME=%s", test.xdg),
			fmt.Sprintf("BITBOX_TEST_APP_DIR=%s", test.wantDir),
			fmt.Sprintf("BITBOX_TEST_APP_DIR_IDX=%d", i),
		}
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if cmd.Run() != nil {
			failed = true
		}
	}
	if failed {
		t.Fail()
	}
}

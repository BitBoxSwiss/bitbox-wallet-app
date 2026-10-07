// SPDX-License-Identifier: Apache-2.0

//go:build !darwin || ios || nosleep

package sleep

// preventSleep is a no-op on non macOS platforms or when nosleep is configured.
func preventSleep() {
}

// allowSleep is a no-op on non macOS platforms or when nosleep is configured.
func allowSleep() {
}

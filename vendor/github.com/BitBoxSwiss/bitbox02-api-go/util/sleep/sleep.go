// SPDX-License-Identifier: Apache-2.0

//go:build !darwin || ios || nosleep

package sleep

// Prevent is a no-op on non macOS platforms or when nosleep is configured.
func Prevent() {
}

// Allow is a no-op on non macOS platforms or when nosleep is configured.
func Allow() {
}

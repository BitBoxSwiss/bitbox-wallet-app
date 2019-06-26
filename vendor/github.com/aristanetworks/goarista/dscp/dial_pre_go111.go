// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

// +build !go1.11

package dscp

import "net"

func addControlConfig(d *net.Dialer, tos byte) {
	// Intentional no-op. go1.10 doesn't support setting Control func
}

// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

// +build go1.11

package dscp

import (
	"context"
	"fmt"
	"net"
	"os"
	"strings"
	"syscall"

	"golang.org/x/sys/unix"
)

// ListenTCPWithTOS is similar to net.ListenTCP but with the socket configured
// to the use the given ToS (Type of Service), to specify DSCP / ECN / class
// of service flags to use for incoming connections.
func ListenTCPWithTOS(address *net.TCPAddr, tos byte) (*net.TCPListener, error) {
	cfg := net.ListenConfig{
		Control: func(network, address string, c syscall.RawConn) error {
			return setTOS111(network, c, tos)
		},
	}

	lsnr, err := cfg.Listen(context.Background(), "tcp", address.String())
	if err != nil {
		return nil, err
	}

	return lsnr.(*net.TCPListener), err
}

func addControlConfig(d *net.Dialer, tos byte) {
	d.Control = func(network, address string, c syscall.RawConn) error {
		return setTOS111(network, c, tos)
	}
}

func setTOS111(network string, c syscall.RawConn, tos byte) error {
	var proto, optname int
	if strings.HasSuffix(network, "4") {
		proto = unix.IPPROTO_IP
		optname = unix.IP_TOS
	} else if strings.HasSuffix(network, "6") {
		proto = unix.IPPROTO_IPV6
		optname = unix.IPV6_TCLASS
	} else {
		return fmt.Errorf("unknown network: %q", network)
	}

	var setsockoptErr error
	err := c.Control(func(fd uintptr) {
		if err := unix.SetsockoptInt(int(fd), proto, optname, int(tos)); err != nil {
			setsockoptErr = os.NewSyscallError("setsockopt", err)
		}
	})
	if setsockoptErr != nil {
		return setsockoptErr
	}
	return err
}

func setTOS(ip net.IP, conn interface{}, tos byte) error {
	// Intentional no-op. In go1.11 we use the control func to set TOS
	return nil
}

// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package netns

import (
	"errors"
	"net"
	"os"

	"github.com/aristanetworks/glog"
)

var hasMount = func(mountPoint string) bool {
	fd, err := os.Open("/proc/mounts")
	if err != nil {
		glog.Fatalf("can't open /proc/mounts")
	}
	defer fd.Close()

	return hasMountInProcMounts(fd, mountPoint)
}

func getNsDir() (string, error) {
	fd, err := os.Open("/proc/mounts")
	if err != nil {
		return "", errors.New("can't open /proc/mounts")
	}
	defer fd.Close()

	return getNsDirFromProcMounts(fd)
}

// NewNSListener creates a new net.Listener bound to a network namespace. The listening socket will
// be bound to the specified local address and will have the specified tos.
func NewNSListener(nsName string, addr *net.TCPAddr, tos byte) (net.Listener, error) {
	// The default namespace doesn't get recreated and avoid the watcher helps with environments
	// that aren't setup for multiple namespaces (eg inside containers)
	if nsName == "" || nsName == "default" {
		return makeListener(nsName, addr, tos)
	}
	nsDir, err := getNsDir()
	if err != nil {
		return nil, err
	}

	return newNSListenerWithDir(nsDir, nsName, addr, tos)
}

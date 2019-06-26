// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package netns

import (
	"bufio"
	"errors"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aristanetworks/fsnotify"
	"github.com/aristanetworks/glog"
	"github.com/aristanetworks/goarista/dscp"
)

var makeListener = func(nsName string, addr *net.TCPAddr, tos byte) (net.Listener, error) {
	var listener net.Listener
	err := Do(nsName, func() error {
		var err error
		listener, err = dscp.ListenTCPWithTOS(addr, tos)
		return err
	})
	return listener, err
}

func accept(listener net.Listener, conns chan<- net.Conn) {
	for {
		c, err := listener.Accept()
		if err != nil {
			glog.Infof("Accept error: %v", err)
			return
		}
		conns <- c
	}
}

func waitForMount(mountPoint string) bool {
	for !hasMount(mountPoint) {
		time.Sleep(time.Second)
		if _, err := os.Stat(mountPoint); err != nil {
			glog.Infof("error stating %s: %v", mountPoint, err)
			return false
		}
	}

	return true
}

// nsListener is a net.Listener that binds to a specific network namespace when it becomes available
// and in case it gets deleted and recreated it will automatically bind to the newly created
// namespace.
type nsListener struct {
	listener net.Listener
	watcher  *fsnotify.Watcher
	nsName   string
	nsFile   string
	addr     *net.TCPAddr
	tos      byte
	done     chan struct{}
	conns    chan net.Conn
}

func (l *nsListener) tearDown() {
	if l.listener != nil {
		glog.Info("Destroying listener")
		l.listener.Close()
		l.listener = nil
	}
}

func (l *nsListener) setUp() bool {
	glog.Infof("Creating listener in namespace %v", l.nsName)
	if err := l.watcher.Add(l.nsFile); err != nil {
		glog.Infof("Can't watch the file (will try again): %v", err)
		return false
	}
	listener, err := makeListener(l.nsName, l.addr, l.tos)
	if err != nil {
		glog.Infof("Can't create TCP listener (will try again): %v", err)
		return false
	}
	l.listener = listener
	go accept(l.listener, l.conns)

	return true
}

func (l *nsListener) watch() {
	var mounted bool
	if hasMount(l.nsFile) {
		mounted = l.setUp()
	}

	for {
		select {
		case <-l.done:
			l.tearDown()
			return
		case ev := <-l.watcher.Events:
			if ev.Name != l.nsFile {
				continue
			}
			if ev.Op&fsnotify.Create == fsnotify.Create {
				if mounted || !waitForMount(l.nsFile) {
					continue
				}
				mounted = l.setUp()
			}
			if ev.Op&fsnotify.Remove == fsnotify.Remove {
				l.tearDown()
				mounted = false
			}
		}
	}
}

func (l *nsListener) setupWatch() error {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	if err = w.Add(filepath.Dir(l.nsFile)); err != nil {
		return err
	}

	l.watcher = w
	go l.watch()
	return nil
}

func newNSListenerWithDir(nsDir, nsName string, addr *net.TCPAddr, tos byte) (net.Listener, error) {
	l := &nsListener{
		nsName: nsName,
		nsFile: filepath.Join(nsDir, nsName),
		addr:   addr,
		tos:    tos,
		done:   make(chan struct{}),
		conns:  make(chan net.Conn),
	}
	if err := l.setupWatch(); err != nil {
		return nil, err
	}

	return l, nil
}

// Accept accepts a connection on the listener socket.
func (l *nsListener) Accept() (net.Conn, error) {
	if c, ok := <-l.conns; ok {
		return c, nil
	}
	return nil, errors.New("listener closed")
}

// Close closes the listener.
func (l *nsListener) Close() error {
	close(l.done)
	return nil
}

// Addr returns the local address of the listener.
func (l *nsListener) Addr() net.Addr {
	return l.addr
}

func hasMountInProcMounts(r io.Reader, mountPoint string) bool {
	// Kernels up to 3.18 export the namespace via procfs and later ones via nsfs
	fsTypes := map[string]bool{"proc": true, "nsfs": true}

	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		l := scanner.Text()
		comps := strings.SplitN(l, " ", 3)
		if len(comps) != 3 || !fsTypes[comps[0]] {
			continue
		}
		if comps[1] == mountPoint {
			return true
		}
	}

	return false
}

func getNsDirFromProcMounts(r io.Reader) (string, error) {
	// Newer EOS versions mount netns under /run
	dirs := map[string]bool{"/var/run/netns": true, "/run/netns": true}

	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		l := scanner.Text()
		comps := strings.SplitN(l, " ", 3)
		if len(comps) != 3 || !dirs[comps[1]] {
			continue
		}
		return comps[1], nil
	}

	return "", errors.New("can't find the netns mount dir")
}

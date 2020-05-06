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

package goserver

import (
	"io"
	"log"
	"sync"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bridgecommon"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	"github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

var (
	once sync.Once
)

// the Go*-named interfaces are implemented in Java for the mobile client. The "Go" prefix is so
// that the code is more readable in Java (interfaces coming from Go-land). The implemented
// interfaces are than translated to implement backend.Environment (see see backendEnvironment
// struct).

// GoReadWriteCloserInterface adapts io.ReadWriteCloser's Read method to return the byte read byte slice
// instead of the .Read([]byte) pattern. This is as gomobile bind seems to make a copy of passed
// slices instead of writing directly to it, so the byte slice never makes it back to Go-land.
type GoReadWriteCloserInterface interface {
	Read(n int) ([]byte, error)
	io.Writer
	io.Closer
}

// GoDeviceInfoInterface adapts usb.DeviceInfo's Open method to return the adapted ReadWriteCloser.
type GoDeviceInfoInterface interface {
	VendorID() int
	ProductID() int
	UsagePage() int
	Interface() int
	Serial() string
	Product() string
	Identifier() string
	Open() (GoReadWriteCloserInterface, error)
}

// GoEnvironmentInterface adapts backend.Environment to return only one DeviceInfo instead of a
// slice of them, as a slice of interfaces does not seem to be supported by gomobile yet.
type GoEnvironmentInterface interface {
	NotifyUser(string)
	DeviceInfo() GoDeviceInfoInterface
	SystemOpen(string) error
	UsingMobileData() bool
}

// readWriteCloser implements io.ReadWriteCloser, translating from GoReadWriteCloserInterface. All methods
// are as-is except for Read().
type readWriteCloser struct {
	GoReadWriteCloserInterface
}

// Read implements io.ReadWriteCloser, translating GoReadWriteCloserInterface.Read, which returns a slice
// instead receiving it as an argument.
func (r readWriteCloser) Read(readBytesOut []byte) (int, error) {
	readBytes, err := r.GoReadWriteCloserInterface.Read(len(readBytesOut))
	if err != nil {
		return 0, err
	}
	copy(readBytesOut, readBytes)
	return len(readBytes), nil
}

// deviceInfo implements usb.DeviceInfo, translating from GoDeviceInfoInterface. All methods are as-is except
// for the Open method.
type deviceInfo struct {
	GoDeviceInfoInterface
}

// Open implements usb.DeviceInfo.
func (d deviceInfo) Open() (io.ReadWriteCloser, error) {
	device, err := d.GoDeviceInfoInterface.Open()
	if err != nil {
		return nil, err
	}
	return readWriteCloser{device}, nil
}

// GoAPIInterface is used to pas api (GET/POST) responses and websocket push notifications to Android.
type GoAPIInterface interface {
	bridgecommon.NativeCommunication
}

// BackendCall bridges GET/POST calls (serverless, directly calling the backend handlers).
func BackendCall(queryID int, jsonQuery string) {
	bridgecommon.BackendCall(queryID, jsonQuery)
}

// UsingMobileDataChanged exposes `bridgecommon.UsingMobileDataChanged` to Java/Kotlin.
func UsingMobileDataChanged() {
	bridgecommon.UsingMobileDataChanged()
}

type goLogHook struct {
}

func (hook goLogHook) Levels() []logrus.Level {
	return []logrus.Level{
		logrus.PanicLevel,
		logrus.FatalLevel,
		logrus.ErrorLevel,
		logrus.WarnLevel,
		logrus.InfoLevel,
		logrus.DebugLevel,
	}
}

func (hook goLogHook) Fire(entry *logrus.Entry) error {
	log.Print(entry.String())
	return nil
}

// Serve serves the BitBoxApp API for use in a mobile client. It is called when the application
// is started or wakes up from sleep.
func Serve(dataDir string, environment GoEnvironmentInterface, goAPI GoAPIInterface) {
	once.Do(func() {
		// SetAppDir can only be called once, but this is okay, since the data dir does not change
		// between during sleep between Shutdown and Serve.
		config.SetAppDir(dataDir)

		// log via builtin log package, as that is redirected to Android's logcat.
		logging.Get().AddHook(goLogHook{})
	})

	testnet := false
	bridgecommon.Serve(
		testnet,
		nil,
		goAPI,
		&bridgecommon.BackendEnvironment{
			NotifyUserFunc: environment.NotifyUser,
			DeviceInfosFunc: func() []usb.DeviceInfo {
				i := environment.DeviceInfo()
				if i == nil {
					return []usb.DeviceInfo{}
				}
				return []usb.DeviceInfo{deviceInfo{i}}
			},
			SystemOpenFunc:      environment.SystemOpen,
			UsingMobileDataFunc: environment.UsingMobileData,
		},
	)
}

// Shutdown is cleaning up after Serve. It is called when the application is closed or goes to
// sleep.
func Shutdown() {
	bridgecommon.Shutdown()
}

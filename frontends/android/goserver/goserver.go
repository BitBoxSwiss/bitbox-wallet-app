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
	"bytes"
	"io"
	"log"
	"net/http"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"

	"github.com/digitalbitbox/bitbox-wallet-app/backend"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	backendHandlers "github.com/digitalbitbox/bitbox-wallet-app/backend/handlers"
	"github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/random"
	"github.com/sirupsen/logrus"
)

var (
	handlers *backendHandlers.Handlers
	token    string
	goAPI    GoAPIInterface

	quitChan chan struct{}
	once     sync.Once
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

// GoEnvironmentInterface adapts backend.Environment to return only one DeviceInfo instead of a slice of
// them, as a slice of interfaces does not seem to be supported by gomobile yet.
type GoEnvironmentInterface interface {
	NotifyUser(string)
	DeviceInfo() GoDeviceInfoInterface
}

// backendEnvironment translates from GoEnvironmentInterface to backend.Environment.
type backendEnvironment struct {
	notifyUser  func(string)
	deviceInfos func() []usb.DeviceInfo
	systemOpen  func(string) error
}

// NotifyUser implements backend.Environment
func (env backendEnvironment) NotifyUser(text string) {
	if env.notifyUser != nil {
		env.notifyUser(text)
	}
}

// DeviceInfos implements backend.Environment
func (env backendEnvironment) DeviceInfos() []usb.DeviceInfo {
	if env.deviceInfos != nil {
		return env.deviceInfos()
	}
	return nil
}

// SystemOpen implements backend.Environment
func (env backendEnvironment) SystemOpen(url string) error {
	if env.systemOpen != nil {
		return env.systemOpen(url)
	}
	return nil
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
	Respond(queryID int, response string)
	PushNotify(msg string)
}

type response struct {
	Body bytes.Buffer
}

func (r *response) Header() http.Header {
	// Not needed.
	return http.Header{}
}

func (r *response) Write(buf []byte) (int, error) {
	r.Body.Write(buf)
	return len(buf), nil
}

func (r *response) WriteHeader(int) {
	// Not needed.
}

// BackendCall bridges GET/POST calls (serverless, directly calling the backend handlers).
func BackendCall(queryID int, jsonQuery string) {
	if handlers == nil {
		return
	}
	query := map[string]string{}
	jsonp.MustUnmarshal([]byte(jsonQuery), &query)
	if query["method"] != "POST" && query["method"] != "GET" {
		panic(errp.Newf("method must be POST or GET, got: %s", query["method"]))
	}
	go func() {
		defer func() {
			// recover from all panics and log error before panicking again
			if r := recover(); r != nil {
				logging.Get().WithGroup("server").WithField("panic", true).Errorf("%v\n%s", r, string(debug.Stack()))
			}
		}()

		resp := &response{}
		request, err := http.NewRequest(query["method"], "/api/"+query["endpoint"], strings.NewReader(query["body"]))
		if err != nil {
			panic(errp.WithStack(err))
		}
		request.Header.Set("Authorization", "Basic "+token)
		handlers.Router.ServeHTTP(resp, request)
		responseBytes := resp.Body.Bytes()
		goAPI.Respond(queryID, string(responseBytes))
	}()
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

// Serve serves the BitBox Wallet API for use in a mobile client. It is called when the application
// is started or wakes up from sleep.
func Serve(dataDir string, environment GoEnvironmentInterface, theGoAPI GoAPIInterface) {
	if quitChan != nil {
		panic("already running; must call Shutdown()")
	}
	quitChan = make(chan struct{})

	once.Do(func() {
		// SetAppDir can only be called once, but this is okay, since the data dir does not change
		// between during sleep between Shutdown and Serve.
		config.SetAppDir(dataDir)
	})
	logging.Set(&logging.Configuration{Output: "STDERR", Level: logrus.DebugLevel})
	goAPI = theGoAPI

	logger := logging.Get()
	// log via builtin log package, as that is redirected to Android's logcat.
	logger.AddHook(goLogHook{})
	log := logger.WithGroup("server")

	log.Info("--------------- Started application --------------")
	log.WithField("goos", runtime.GOOS).WithField("goarch", runtime.GOARCH).WithField("version", backend.Version).Info("environment")

	backend, err := backend.NewBackend(
		arguments.NewArguments(config.AppDir(), false, false, false, false, false),
		backendEnvironment{
			notifyUser: environment.NotifyUser,
			deviceInfos: func() []usb.DeviceInfo {
				i := environment.DeviceInfo()
				if i == nil {
					return []usb.DeviceInfo{}
				}
				return []usb.DeviceInfo{deviceInfo{i}}
			},
			systemOpen: nil,
		})
	if err != nil {
		log.WithError(err).Fatal("Failed to create backend")
	}

	token, err = random.HexString(16)
	if err != nil {
		log.WithError(err).Fatal("Failed to generate random string")
	}

	events := backend.Events()
	go func() {
		for {
			select {
			case <-quitChan:
				return
			default:
				select {
				case <-quitChan:
					return
				case event := <-events:
					goAPI.PushNotify(string(jsonp.MustMarshal(event)))
				}
			}
		}
	}()

	// the port is unused in the Android app, as we bridge directly without a server.
	handlers = backendHandlers.NewHandlers(backend,
		backendHandlers.NewConnectionData(-1, token))

}

// Shutdown is cleaning up after Serve. It is called when the application is closed or goes to
// sleep.
func Shutdown() {
	if quitChan != nil {
		close(quitChan)
		quitChan = nil
	}
}

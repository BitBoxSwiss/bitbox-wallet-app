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

package main

/*
#ifndef BACKEND_H
#define BACKEND_H
#include <string.h>
#include <stdint.h>

typedef void (*pushNotificationsCallback) (const char*);
static void pushNotify(pushNotificationsCallback f, const char* msg) {
    f(msg);
}

typedef void (*responseCallback) (int, const char*);
static void respond(responseCallback f, int queryID, const char* msg) {
    f(queryID, msg);
}

typedef void (*notifyUserCallback) (const char*);
static void notifyUser(notifyUserCallback f, const char* msg) {
    f(msg);
}
#endif
*/
import "C"

import (
	"flag"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bridgecommon"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	"github.com/digitalbitbox/bitbox-wallet-app/util/system"
)

// nativeCommunication implements bridge.NativeCommunication
type nativeCommunication struct {
	respond    func(queryID int, response string)
	pushNotify func(msg string)
}

// Respond implements bridge.NativeCommunication
func (communication *nativeCommunication) Respond(queryID int, response string) {
	communication.respond(queryID, response)
}

// PushNotify implements bridge.NativeCommunication
func (communication *nativeCommunication) PushNotify(msg string) {
	communication.pushNotify(msg)
}

//export backendCall
func backendCall(queryID C.int, s *C.char) {
	bridgecommon.BackendCall(int(queryID), C.GoString(s))
}

//export serve
func serve(
	pushNotificationsCallback C.pushNotificationsCallback,
	responseCallback C.responseCallback,
	notifyUserCallback C.notifyUserCallback,
) {
	// workaround: this flag is parsed by qtwebengine, but flag.Parse() quits the app on
	// unrecognized flags
	// _ = flag.Int("remote-debugging-port", 0, "")
	testnet := flag.Bool("testnet", false, "activate testnets")
	flag.Parse()

	bridgecommon.Serve(
		*testnet,
		&nativeCommunication{
			respond: func(queryID int, response string) {
				C.respond(responseCallback, C.int(queryID), C.CString(response))
			},
			pushNotify: func(msg string) {
				C.pushNotify(pushNotificationsCallback, C.CString(msg))
			},
		},
		&bridgecommon.BackendEnvironment{
			NotifyUserFunc: func(text string) {
				C.notifyUser(notifyUserCallback, C.CString(text))
			},
			DeviceInfosFunc: usb.DeviceInfos,
			SystemOpenFunc:  system.Open,
		},
	)
}

// Don't remove - needed for the C compilation.
func main() {
}

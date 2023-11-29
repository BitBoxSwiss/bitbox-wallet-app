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
#include <stdlib.h>

// Workaround to be able to use `const char*` as a param type in the exported Go functions.
typedef const char cchar_t;

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

typedef char* (*getSaveFilenameCallback) (const char*);
static char* getSaveFilename(getSaveFilenameCallback f, const char* suggestedfilename) {
    return f(suggestedfilename);
}

// see frontends/qt/libserver.h for doc comments
typedef void (*cppHeapFree) (void* ptr);
static void customHeapFree(cppHeapFree f, void* ptr) {
	f(ptr);
}

#endif
*/
import "C"

import (
	"flag"
	"os"
	"runtime"
	"strings"
	"unsafe"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bridgecommon"
	btctypes "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/system"
)

// nativeCommunication implements bridge.NativeCommunication.
type nativeCommunication struct {
	respond    func(queryID int, response string)
	pushNotify func(msg string)
}

// Respond implements bridge.NativeCommunication.
func (communication *nativeCommunication) Respond(queryID int, response string) {
	communication.respond(queryID, response)
}

// PushNotify implements bridge.NativeCommunication.
func (communication *nativeCommunication) PushNotify(msg string) {
	communication.pushNotify(msg)
}

//export backendCall
func backendCall(queryID C.int, s *C.char) {
	bridgecommon.BackendCall(int(queryID), C.GoString(s))
}

//export handleURI
func handleURI(uri *C.cchar_t) {
	bridgecommon.HandleURI(C.GoString(uri))
}

func matchDarkTheme(themeName string) bool {
	return strings.Contains(strings.ToLower(themeName), "dark")
}

//export serve
func serve(
	cppHeapFreeFn C.cppHeapFree,
	pushNotificationsFn C.pushNotificationsCallback,
	responseFn C.responseCallback,
	notifyUserFn C.notifyUserCallback,
	preferredLocale *C.char,
	getSaveFilenameFn C.getSaveFilenameCallback,
) {
	log := logging.Get().WithGroup("server")
	log.WithField("args", os.Args).Info("Started Qt application")
	testnet := flag.Bool("testnet", false, "activate testnets")

	if runtime.GOOS == "darwin" {
		// eat "-psn_xxxx" on Mac, which is passed when starting an app from Finder for the first time.
		// See also: https://stackoverflow.com/questions/10242115/os-x-strange-psn-command-line-parameter-when-launched-from-finder
		for _, arg := range os.Args[1:] {
			trimmed := strings.TrimLeft(arg, "-")
			if strings.HasPrefix(trimmed, "psn_") {
				flag.Bool(trimmed, false, "<ignored>")
			}
		}
	}

	gapLimitsReceive := flag.Uint("gapLimitReceive", 0, "gap limit for receive addresses. Do not use this unless you know what this means.")
	gapLimitsChange := flag.Uint("gapLimitChange", 0, "gap limit for change addresses. Do not use this unless you know what this means.")

	flag.Parse()

	var gapLimits *btctypes.GapLimits
	if *gapLimitsReceive != 0 || *gapLimitsChange != 0 {
		gapLimits = &btctypes.GapLimits{
			Receive: uint16(*gapLimitsReceive),
			Change:  uint16(*gapLimitsChange),
		}
	}

	// Capture C string early to avoid potential use when it's already popped
	// from the stack.
	nativeLocale := C.GoString(preferredLocale)

	bridgecommon.Serve(
		*testnet,
		gapLimits,
		&nativeCommunication{
			respond: func(queryID int, response string) {
				cResponse := C.CString(response)
				defer C.free(unsafe.Pointer(cResponse))
				C.respond(responseFn, C.int(queryID), cResponse)
			},
			pushNotify: func(msg string) {
				cMsg := C.CString(msg)
				defer C.free(unsafe.Pointer(cMsg))
				C.pushNotify(pushNotificationsFn, cMsg)
			},
		},
		&bridgecommon.BackendEnvironment{
			NotifyUserFunc: func(text string) {
				cText := C.CString(text)
				defer C.free(unsafe.Pointer(cText))
				C.notifyUser(notifyUserFn, cText)
			},
			DeviceInfosFunc:     usb.DeviceInfos,
			SystemOpenFunc:      system.Open,
			UsingMobileDataFunc: func() bool { return false },
			NativeLocaleFunc:    func() string { return nativeLocale },
			GetSaveFilenameFunc: func(suggestedFilename string) string {
				cSuggestedFilename := C.CString(suggestedFilename)
				defer C.free(unsafe.Pointer(cSuggestedFilename))
				cFilename := C.getSaveFilename(getSaveFilenameFn, cSuggestedFilename)
				if cFilename == nil {
					return ""
				}
				defer C.customHeapFree(cppHeapFreeFn, unsafe.Pointer(cFilename))
				filename := C.GoString(cFilename)
				return filename
			},
			SetDarkThemeFunc:    func(bool) {},
			DetectDarkThemeFunc: detectDarkTheme,
			AuthFunc: func() {
				log.Info("Qt auth")
				authResult(true)
			},
		},
	)
}

//export systemOpen
func systemOpen(url *C.cchar_t) {
	goURL := C.GoString(url)
	if err := system.Open(goURL); err != nil {
		logging.Get().WithGroup("server").WithError(err).Errorf("systemOpen: error opening %v", goURL)
	}
}

//export goLog
func goLog(msg *C.cchar_t) {
	goMsg := C.GoString(msg)
	logging.Get().WithGroup("qt-frontend").Info(goMsg)
}

func authResult(ok bool) {
	bridgecommon.AuthResult(ok)
}

// Don't remove - needed for the C compilation.
func main() {
}

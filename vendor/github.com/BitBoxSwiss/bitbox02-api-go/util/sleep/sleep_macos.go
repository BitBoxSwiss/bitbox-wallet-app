// Copyright 2024 Shift Crypto AG
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

//go:build darwin && !ios && !nosleep

package sleep

/*
#cgo LDFLAGS: -framework IOKit
#include <IOKit/pwr_mgt/IOPMLib.h>
#include <IOKit/IOReturn.h>
#include <stdbool.h>

static IOPMAssertionID _assertionID;
static bool _assertionCreated = false;
void preventSleep() {
    if (_assertionCreated) {
        return;
    }
    IOReturn success = IOPMAssertionCreateWithName(kIOPMAssertionTypeNoDisplaySleep, kIOPMAssertionLevelOn, CFSTR("Prevent Sleep"), &_assertionID);
    if (success == kIOReturnSuccess) {
        // Successfully disabled sleep.
        _assertionCreated = true;
    }
}

void allowSleep() {
   if (_assertionCreated) {
       IOPMAssertionRelease(_assertionID);
       _assertionCreated = false;
   }
}
*/
import "C"

// Prevent prevents macOS from going to sleep. Must be paired with `Allow()`.
func Prevent() {
	C.preventSleep()
}

// Allow allows macOS to go to sleep.
func Allow() {
	C.allowSleep()
}

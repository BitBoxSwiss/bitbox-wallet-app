// SPDX-License-Identifier: Apache-2.0

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

func preventSleep() {
	C.preventSleep()
}

func allowSleep() {
	C.allowSleep()
}

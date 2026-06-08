// SPDX-License-Identifier: Apache-2.0

//go:build ios

package mobileserver

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Foundation
#import <Foundation/Foundation.h>
const char* getSystemTimeZone() {
    NSTimeZone *timeZone = [NSTimeZone systemTimeZone];
    NSString *timeZoneName = [timeZone name];
    return [timeZoneName UTF8String];
}
*/
import "C"

import (
	"strings"
	"time"
)

func getSystemTimeZone() string {
	tz := C.getSystemTimeZone()
	return C.GoString(tz)
}

// fixTimezone sets the local timezone on iOS. This is a workaround to the bug that on iOS,
// time.Local is hard-coded to UTC. See https://github.com/golang/go/issues/20797.
//
// We need the correct timezone to be able to send the `time.Now().Zone()` offset to the BitBox02.
// Without it, the BitBox02 will always display UTC time instead of local time.
//
// This fix is copied from https://github.com/anyproto/anytype-heart/pull/775/ (referenced in the
// above issue).
func fixTimezone() {
	tzName := strings.TrimSpace(getSystemTimeZone())
	if len(tzName) == 0 {
		return
	}
	z, err := time.LoadLocation(tzName)
	if err != nil {
		return
	}
	time.Local = z
}

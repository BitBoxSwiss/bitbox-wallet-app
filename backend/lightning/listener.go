// Copyright 2018 Shift Devices AG
// Copyright 2023 Shift Crypto AG
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

package lightning

import (
	"github.com/breez/breez-sdk-go/breez_sdk"
	"github.com/sirupsen/logrus"
)

var logListener *BreezLogListener

// BreezLogListener stores the log handler for listening to log events from the Breez SDK.
type BreezLogListener struct {
	log *logrus.Entry
}

// Log receives log entries of different log levels and logs then the handlers log.
// Implementation of breez_sdk.EventListener.
func (listener *BreezLogListener) Log(logEntry breez_sdk.LogEntry) {
	if logEntry.Level != "TRACE" {
		listener.log.Infof("BreezSDK: [%s] %s", logEntry.Level, logEntry.Line)
	} else {
		listener.log.Tracef("BreezSDK: [%s] %s", logEntry.Level, logEntry.Line)
	}
}

// initializeLogging manages the Breez SDK logging handling by only calling SetLogStream once.
func initializeLogging(log *logrus.Entry) {
	if logListener == nil {
		logListener = &BreezLogListener{log}

		if err := breez_sdk.SetLogStream(logListener); err != nil {
			log.WithError(err).Warn("BreezSDK: SetLogStream failed")
		}
	}
}

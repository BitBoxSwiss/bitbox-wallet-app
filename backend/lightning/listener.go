// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/sirupsen/logrus"
)

type sdkLogger struct {
	log *logrus.Entry
}

func (logger *sdkLogger) Log(l breez_sdk_spark.LogEntry) {
	logger.log.Printf("Received log [%v]: %v", l.Level, l.Line)
}

var logListener *sdkLogger

// initializeLogging manages the Breez SDK logging handling by only calling SetLogStream once.
func initializeLogging(log *logrus.Entry) {
	if logListener == nil {
		logListener = &sdkLogger{log}

		var loggerImpl breez_sdk_spark.Logger = logListener
		if err := breez_sdk_spark.InitLogging(nil, &loggerImpl, nil); err != nil {
			log.WithError(err).Error("BreezSDK: Error init logging")
		}
	}
}

// var logListener *BreezLogListener

// // BreezLogListener stores the log handler for listening to log events from the Breez SDK.
// type BreezLogListener struct {
// 	log *logrus.Entry
// }

// // Log receives log entries of different log levels and logs then the handlers log.
// // Implementation of breez_sdk.EventListener.
// func (listener *BreezLogListener) Log(logEntry breez_sdk.LogEntry) {
// 	if logEntry.Level != "TRACE" {
// 		listener.log.Infof("BreezSDK: [%s] %s", logEntry.Level, logEntry.Line)
// 	} else {
// 		listener.log.Tracef("BreezSDK: [%s] %s", logEntry.Level, logEntry.Line)
// 	}
// }

// // initializeLogging manages the Breez SDK logging handling by only calling SetLogStream once.
// func initializeLogging(log *logrus.Entry) {
// 	if logListener == nil {
// 		logListener = &BreezLogListener{log}

// 		if err := breez_sdk.SetLogStream(logListener); err != nil {
// 			log.WithError(err).Warn("BreezSDK: SetLogStream failed")
// 		}
// 	}
// }

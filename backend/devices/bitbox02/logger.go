// SPDX-License-Identifier: Apache-2.0

package bitbox02

import (
	"github.com/sirupsen/logrus"
)

// logger converts a logrus logger to firmware.Logger expected by firmware.Device.
type logger struct {
	log *logrus.Entry
}

func (log logger) Error(msg string, err error) {
	if err != nil {
		log.log.WithError(err).Error(msg)
	} else {
		log.log.Error(msg)
	}
}
func (log logger) Info(msg string) {
	log.log.Info(msg)
}
func (log logger) Debug(msg string) {
	log.log.Debug(msg)
}

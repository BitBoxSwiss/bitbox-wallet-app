// Copyright 2018-2019 Shift Cryptosecurity AG
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

// Package mocks contains the mock implementations to be used in testing.
package mocks

import "github.com/flynn/noise"

// Communication is a mock implementation of firmware.Communication.
type Communication struct {
	MockQuery func([]byte) ([]byte, error)
	MockClose func()
}

// Query implements firmware.Query.
func (communication *Communication) Query(msg []byte) ([]byte, error) {
	return communication.MockQuery(msg)
}

// Close implements firmware.Close.
func (communication *Communication) Close() {
	communication.MockClose()
}

// Config is a mock implementation of firmware.ConfigInterface.
type Config struct{}

// ContainsDeviceStaticPubkey implements firmware.Communication.
func (config *Config) ContainsDeviceStaticPubkey(pubkey []byte) bool {
	return false
}

// AddDeviceStaticPubkey implements firmware.Communication.
func (config *Config) AddDeviceStaticPubkey(pubkey []byte) error {
	return nil
}

// GetAppNoiseStaticKeypair implements firmware.Communication.
func (config *Config) GetAppNoiseStaticKeypair() *noise.DHKey {
	return nil
}

// SetAppNoiseStaticKeypair implements firmware.Communication.
func (config *Config) SetAppNoiseStaticKeypair(key *noise.DHKey) error {
	return nil
}

// Logger is a mock implementation of firmware.Logger.
type Logger struct{}

// Error implements firmware.Logger.
func (logger *Logger) Error(msg string, err error) {
}

// Info implements firmware.Logger.
func (logger *Logger) Info(msg string) {
}

// Debug implements firmware.Logger.
func (logger *Logger) Debug(msg string) {
}

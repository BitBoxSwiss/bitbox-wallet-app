// Copyright 2019 Shift Devices AG
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

package bitboxbase

import (
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/updater"
)

// Interface represents bitbox base.
type Interface interface {
	Init(testing bool)

	// Identifier returns the bitboxBaseID.
	Identifier() string

	// GetUpdater returns the updater so we can listen to its events.
	GetUpdaterInstance() *updater.Updater

	// Close tells the bitboxbase to close all connections.
	Close()

	//GetRegisterTime implements a getter for the timestamp of when the bitboxBase was registered
	GetRegisterTime() time.Time

	// BlockInfo returns some blockchain information.
	BlockInfo() string
}

//BitBoxBase provides the dictated bitboxbase api to communicate with the base
type BitBoxBase struct {
	bitboxBaseID    string //This is just the ip at the moment, but will be an actual unique string, once the noise pairing is implemented
	registerTime    time.Time
	closed          bool
	updaterInstance *updater.Updater
}

//NewBitBoxBase creates a new bitboxBase instance
func NewBitBoxBase(ip string, id string) (*BitBoxBase, error) {
	bitboxBase := &BitBoxBase{
		bitboxBaseID:    id,
		closed:          false,
		updaterInstance: updater.NewUpdater(),
		registerTime:    time.Now(),
	}
	err := bitboxBase.GetUpdaterInstance().Connect(ip, bitboxBase.bitboxBaseID)
	return bitboxBase, err
}

//GetUpdaterInstance return ths current instance of the updater
func (base *BitBoxBase) GetUpdaterInstance() *updater.Updater {
	return base.updaterInstance
}

//BlockInfo returns the received blockinfo packet from the updater
func (base *BitBoxBase) BlockInfo() string {
	return base.GetUpdaterInstance().BlockInfo()
}

//Identifier implements a getter for the bitboxBase ID
func (base *BitBoxBase) Identifier() string {
	return base.bitboxBaseID
}

//GetRegisterTime implements a getter for the timestamp of when the bitboxBase was registered
func (base *BitBoxBase) GetRegisterTime() time.Time {
	return base.registerTime
}

//Close implements a method to unset the bitboxBase
func (base *BitBoxBase) Close() {
	base.GetUpdaterInstance().Stop()
	base.closed = true
}

//Init initializes the bitboxBase
func (base *BitBoxBase) Init(testing bool) {
}

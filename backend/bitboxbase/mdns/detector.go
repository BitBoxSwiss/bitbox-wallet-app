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

//Package mdns manages detects and/or registers new bitbox bases.
package mdns

import (
	"context"
	"net"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/grandcat/zeroconf"
	"github.com/sirupsen/logrus"
)

// Detector listens for new bitboxbases and creates a new bitboxBase when detected.
type Detector struct {
	baseDeviceInterface map[string]bitboxbase.Interface

	onRegister   func(bitboxbase.Interface) error
	onUnregister func(string)

	removedIDs map[string]bool //keeps track of the bases that were removed manually by the user.

	log *logrus.Entry
}

// NewDetector creates a new detector. onRegister is called when a bitboxbase has been
// inserted. onUnregister is called when the bitboxbase has been removed.
//
func NewDetector(
	onRegister func(bitboxbase.Interface) error,
	onUnregister func(string),
) *Detector {
	return &Detector{
		baseDeviceInterface: map[string]bitboxbase.Interface{},
		onRegister:          onRegister,
		onUnregister:        onUnregister,
		removedIDs:          make(map[string]bool),

		log: logging.Get().WithGroup("detector"),
	}
}

// TryMakeNewBase attempts to create a new bitboxBase connection to the BitBox base. Returns true if successful, false otherwise.
func (detector *Detector) TryMakeNewBase(ip string) (bool, error) {
	for bitboxBaseID, bitboxBase := range detector.baseDeviceInterface {
		// Check if bitboxbase was removed.
		if detector.checkIfRemoved(bitboxBaseID) {
			bitboxBase.Close()
			delete(detector.baseDeviceInterface, bitboxBaseID)
			detector.onUnregister(bitboxBaseID)
			detector.log.WithField("bitboxbase-id", bitboxBaseID).Info("Unregistered bitboxbase")
		}
	}

	// Make the id the ip for now, later the pairing should be factored in here as well.
	bitboxBaseID := ip
	// Skip if already registered.
	if _, ok := detector.baseDeviceInterface[bitboxBaseID]; ok {
		return false, nil
	}
	var baseDevice bitboxbase.Interface
	var err error
	baseDevice, err = bitboxbase.NewBitBoxBase(ip, bitboxBaseID)

	if err != nil {
		detector.log.WithError(err).Error("Failed to register Base")
		return false, err
	}
	detector.baseDeviceInterface[bitboxBaseID] = baseDevice
	if err := detector.onRegister(baseDevice); err != nil {
		detector.log.WithError(err).Error("Failed to execute on-register")
		return false, err
	}
	return true, nil
}

// RemoveBase allows external objects to delete a detector entry.
func (detector *Detector) RemoveBase(bitboxBaseID string) {
	if _, ok := detector.baseDeviceInterface[bitboxBaseID]; ok {
		delete(detector.baseDeviceInterface, bitboxBaseID)
		detector.removedIDs[bitboxBaseID] = true
	}
}

// checkIfRemoved returns true if a bitboxbase was detected in, but is not reachable anymore.
func (detector *Detector) checkIfRemoved(bitboxBaseID string) bool {
	//TODO implement this function, should check if the bitboxBase is reachable, if not properly unregister it.
	return false
}

//mdnsLookup scans the localnetwork and creates a new base if one is found.
func (detector *Detector) mdnsLookup(ctx context.Context) {
	entries := make(chan *zeroconf.ServiceEntry)
	go func(results <-chan *zeroconf.ServiceEntry) {
		for entry := range results {
			if len(entry.AddrIPv4) == 0 {
				continue
			}
			bitboxBaseID := net.IP.String(entry.AddrIPv4[0]) + ":8845"
			//Check that this ID is not registered
			if _, ok := detector.baseDeviceInterface[bitboxBaseID]; ok {
				continue
			}
			//Check that the ID was not removed within the same session
			if _, ok := detector.removedIDs[bitboxBaseID]; ok {
				continue
			}
			_, err := detector.TryMakeNewBase(bitboxBaseID)
			if err != nil {
				detector.log.WithError(err).Error("Failed to create new base:", err.Error())
			}
		}
	}(entries)

	resolver, err := zeroconf.NewResolver(nil)
	if err != nil {
		detector.log.WithError(err).Error("Failed to initialize resolver:", err.Error())
	}
	err = resolver.Browse(ctx, "_bitboxbase._tcp", "local.", entries)
	if err != nil {
		detector.log.WithError(err).Error("Failed to browse:", err.Error())
	}
}

// listen runs a for loop and creates a new context that lasts for every new mdns scan.
func (detector *Detector) listen() {
	for {
		ctx, cancel := context.WithCancel(context.Background())
		go detector.mdnsLookup(ctx)
		time.Sleep(15 * time.Second)
		cancel()
		<-ctx.Done()
	}
}

// Start listens for inserted/removed base devices forever.
func (detector *Detector) Start() {
	go detector.listen()
}

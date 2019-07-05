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

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	micromdns "github.com/micro/mdns"

	"github.com/sirupsen/logrus"
)

const (
	service           = "_bitboxbase._tcp"
	discoveryDuration = time.Second * 10
)

// Detector listens for new bitboxbases and creates a new bitboxBase when detected.
type Detector struct {
	foundBases          map[string]string
	baseDeviceInterface map[string]bitboxbase.Interface

	onRegister   func(bitboxbase.Interface) error
	onUnregister func(string)

	removedIDs map[string]bool //keeps track of the bases that were removed manually by the user.

	log                 *logrus.Entry
	config              *config.Config
	bitboxBaseConfigDir string
}

// NewDetector creates a new detector. onRegister is called when a bitboxbase has been
// inserted. onUnregister is called when the bitboxbase has been removed.
//
func NewDetector(
	onRegister func(bitboxbase.Interface) error,
	onUnregister func(string),
	config *config.Config,
	bitboxBaseConfigDir string,
) *Detector {
	return &Detector{
		foundBases:          make(map[string]string),
		baseDeviceInterface: map[string]bitboxbase.Interface{},
		onRegister:          onRegister,
		onUnregister:        onUnregister,
		removedIDs:          make(map[string]bool),
		config:              config,
		bitboxBaseConfigDir: bitboxBaseConfigDir,

		log: logging.Get().WithGroup("detector"),
	}
}

// TryMakeNewBase attempts to create a new bitboxBase connection to the BitBox base. Returns true if successful, false otherwise.
func (detector *Detector) TryMakeNewBase(address string) (bool, error) {
	for bitboxBaseID, bitboxBase := range detector.baseDeviceInterface {
		// Check if bitboxbase was removed.
		if detector.checkIfRemoved(bitboxBaseID) {
			bitboxBase.Close()
			delete(detector.baseDeviceInterface, bitboxBaseID)
			detector.onUnregister(bitboxBaseID)
			detector.log.WithField("bitboxbase-id", bitboxBaseID).Info("Unregistered bitboxbase")
		}
	}

	// Make the id the address for now, later the pairing should be factored in here as well.
	bitboxBaseID := address
	// Skip if already registered.
	if _, ok := detector.baseDeviceInterface[bitboxBaseID]; ok {
		return false, errp.New("Base already registered")
	}

	baseDevice, err := bitboxbase.NewBitBoxBase(address, bitboxBaseID, detector.config, detector.bitboxBaseConfigDir)

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

// mdnsScan scans the local network forever for BitBox Base devices.
func (detector *Detector) mdnsScan() {
	for {
		entries := make(chan *micromdns.ServiceEntry)
		go func() {
			for entry := range entries {
				host := entry.Host
				resolvedHosts, err := net.LookupHost(host)
				if err != nil {
					detector.log.WithError(err).Error("Failed to resolve hostname: ", host)
					continue
				}
				baseIPv4 := resolvedHosts[0] + ":8845"

				if _, ok := detector.foundBases[baseIPv4]; !ok {
					detector.foundBases[baseIPv4] = host
				}
			}
		}()

		ctx, cancel := context.WithTimeout(context.Background(), discoveryDuration)

		// Start mdns lookup
		err := micromdns.Lookup(service, entries)
		if err != nil {
			detector.log.WithError(err).Error("mDNS lookup failed for service: ", service)
		}

		<-ctx.Done()

		// Wait one second for go routine shutdown, necessary to correctly filter by "_bitboxbase._tcp"
		time.Sleep(time.Second * 1)
		close(entries)
		cancel()
	}
}

// Start starts a continuous mDNS scan for BitBox Base devices on local network.
func (detector *Detector) Start() {
	go detector.mdnsScan()
}

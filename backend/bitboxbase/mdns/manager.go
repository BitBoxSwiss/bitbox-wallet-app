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

// Package mdns manages and/or registers new bitbox bases.
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

// Manager listens for new bitboxbases and handles their (de)registration.
type Manager struct {
	foundBases          map[string]string
	baseDeviceInterface map[string]bitboxbase.Interface

	onRegister   func(bitboxbase.Interface) error
	onUnregister func(string)

	removedIDs map[string]bool // keeps track of the bases that were removed manually by the user.

	log    *logrus.Entry
	config *config.Config
}

// NewManager creates a new manager. onRegister is called when a bitboxbase has been
// inserted. onUnregister is called when the bitboxbase has been removed.
//
func NewManager(
	onRegister func(bitboxbase.Interface) error,
	onUnregister func(string),
	config *config.Config,
) *Manager {
	return &Manager{
		foundBases:          make(map[string]string),
		baseDeviceInterface: map[string]bitboxbase.Interface{},
		onRegister:          onRegister,
		onUnregister:        onUnregister,
		removedIDs:          make(map[string]bool),
		config:              config,

		log: logging.Get().WithGroup("manager"),
	}
}

// TryMakeNewBase attempts to create a new bitboxBase connection to the BitBox base. Returns true if successful, false otherwise.
func (manager *Manager) TryMakeNewBase(address string) (bool, error) {
	for bitboxBaseID, bitboxBase := range manager.baseDeviceInterface {
		// Check if bitboxbase was removed.
		if manager.checkIfRemoved(bitboxBaseID) {
			bitboxBase.Close()
			delete(manager.baseDeviceInterface, bitboxBaseID)
			manager.onUnregister(bitboxBaseID)
			manager.log.WithField("bitboxbase-id", bitboxBaseID).Info("Unregistered bitboxbase")
		}
	}

	// Make the id the address for now, later the pairing should be factored in here as well.
	bitboxBaseID := address
	// Skip if already registered.
	if _, ok := manager.baseDeviceInterface[bitboxBaseID]; ok {
		return false, errp.New("Base already registered")
	}

	baseDevice, err := bitboxbase.NewBitBoxBase(address, bitboxBaseID, manager.config)

	if err != nil {
		manager.log.WithError(err).Error("Failed to register Base")
		return false, err
	}
	manager.baseDeviceInterface[bitboxBaseID] = baseDevice
	if err := manager.onRegister(baseDevice); err != nil {
		manager.log.WithError(err).Error("Failed to execute on-register")
		return false, err
	}
	return true, nil
}

// RemoveBase allows external objects to delete a manager entry.
func (manager *Manager) RemoveBase(bitboxBaseID string) {
	if _, ok := manager.baseDeviceInterface[bitboxBaseID]; ok {
		delete(manager.baseDeviceInterface, bitboxBaseID)
		manager.removedIDs[bitboxBaseID] = true
	}
}

// checkIfRemoved returns true if a bitboxbase was detected in, but is not reachable anymore.
func (manager *Manager) checkIfRemoved(bitboxBaseID string) bool {
	// TODO implement this function, should check if the bitboxBase is reachable, if not properly unregister it.
	return false
}

// mdnsScan scans the local network forever for BitBox Base devices.
func (manager *Manager) mdnsScan() {
	for {
		entries := make(chan *micromdns.ServiceEntry)
		go func() {
			for entry := range entries {
				host := entry.Host
				resolvedHosts, err := net.LookupHost(host)
				if err != nil {
					manager.log.WithError(err).Error("Failed to resolve hostname: ", host)
					continue
				}
				baseIPv4 := resolvedHosts[0] + ":8845"

				if _, ok := manager.foundBases[baseIPv4]; !ok {
					manager.foundBases[baseIPv4] = host
				}
			}
		}()

		ctx, cancel := context.WithTimeout(context.Background(), discoveryDuration)

		// Start mdns lookup
		err := micromdns.Lookup(service, entries)
		if err != nil {
			manager.log.WithError(err).Error("mDNS lookup failed for service: ", service)
		}

		<-ctx.Done()

		// Wait one second for go routine shutdown, necessary to correctly filter by "_bitboxbase._tcp"
		time.Sleep(time.Second * 1)
		close(entries)
		cancel()
	}
}

// Start starts a continuous mDNS scan for BitBox Base devices on local network.
func (manager *Manager) Start() {
	go manager.mdnsScan()
}

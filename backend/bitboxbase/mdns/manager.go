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
	"net"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/bbbconfig"
	appConfig "github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"

	micromdns "github.com/micro/mdns"

	"github.com/sirupsen/logrus"
)

const (
	domain            = "local"
	service           = "_bitboxbase._tcp"
	discoveryDuration = time.Second * 10
)

// BaseDeviceInfo contains the IPv4s and Hostname of a discovered BitBox Base.
type BaseDeviceInfo struct {
	Hostname string
	IPv4     string
}

// Manager listens for new bitboxbases and handles their (de)registration.
type Manager struct {
	onDetect func()
	mutex    locker.Locker

	detectedBases map[string]string // Do not change this map to pointer types or anything else, the reflect.DeepEqual comparison in mdnsScan may break

	baseDeviceBitBoxBase map[string]*bitboxbase.BitBoxBase

	onRegister    func(*bitboxbase.BitBoxBase, string, string) error
	onUnregister  func(string)
	onRemove      func(string)
	onReconnected func(string)

	log                 *logrus.Entry
	appConfig           *appConfig.Config
	bitboxBaseConfigDir string
	bbbConfig           *bbbconfig.BBBConfig
	socksProxy          socksproxy.SocksProxy
}

// NewManager creates a new manager. onRegister is called when a bitboxbase has been
// inserted. onUnregister is called when the bitboxbase has been removed.
func NewManager(
	onDetect func(),
	onRegister func(*bitboxbase.BitBoxBase, string, string) error,
	onUnregister func(string),
	onRemove func(string),
	onReconnected func(string),
	appConfig *appConfig.Config,
	bitboxBaseConfigDir string,
	socksProxy socksproxy.SocksProxy,
) *Manager {
	manager := &Manager{
		baseDeviceBitBoxBase: map[string]*bitboxbase.BitBoxBase{},
		onDetect:             onDetect,
		detectedBases:        map[string]string{},
		onRegister:           onRegister,
		onUnregister:         onUnregister,
		onRemove:             onRemove,
		onReconnected:        onReconnected,
		appConfig:            appConfig,
		bitboxBaseConfigDir:  bitboxBaseConfigDir,
		socksProxy:           socksProxy,

		log: logging.Get().WithGroup("manager"),
	}
	manager.bbbConfig = bbbconfig.NewBBBConfig(manager.bitboxBaseConfigDir)
	return manager
}

// TryMakeNewBase attempts to create a new bitboxBase connection to the BitBox base. Returns true if successful, false otherwise.
func (manager *Manager) TryMakeNewBase(address string) (bool, error) {
	defer manager.mutex.Lock()()
	for bitboxBaseID, bitboxBase := range manager.baseDeviceBitBoxBase {
		// Check if bitboxbase was removed.
		if manager.checkIfRemoved(bitboxBase) {
			manager.log.Infof("Removing bitboxbase with id %q", bitboxBaseID)
			bitboxBase.Close()
			delete(manager.baseDeviceBitBoxBase, bitboxBaseID)
			manager.onUnregister(bitboxBaseID)
			manager.log.WithField("bitboxbase-id", bitboxBaseID).Info("Unregistered bitboxbase")
		}
	}

	// Make the id the address for now, later the pairing should be factored in here as well.
	bitboxBaseID := address

	// Skip if already registered.
	if _, ok := manager.baseDeviceBitBoxBase[bitboxBaseID]; ok {
		return false, errp.New("Base already registered")
	}

	manager.log.WithField("host", manager.detectedBases[address]).WithField("address", address)
	hostname := manager.resolveIP(bitboxBaseID)
	baseDevice, err := bitboxbase.NewBitBoxBase(
		address, bitboxBaseID, hostname, manager.appConfig, manager.bbbConfig,
		manager.onUnregister, manager.onRemove, manager.onReconnected, manager.socksProxy)

	if err != nil {
		manager.log.WithError(err).Error("Failed to register Base")
		return false, err
	}

	manager.baseDeviceBitBoxBase[bitboxBaseID] = baseDevice
	if err := manager.onRegister(baseDevice, hostname, bitboxBaseID); err != nil {
		manager.log.WithError(err).Error("Failed to execute on-register")
		return false, err
	}

	if err = baseDevice.EstablishConnection(); err != nil {
		return false, err
	}

	if err = baseDevice.Config().AddRegisteredBase(bitboxBaseID, hostname); err != nil {
		manager.log.WithError(err).Error("Unable to store Base config file")
	}
	return true, nil
}

// RemoveBase allows external objects to delete a manager entry.
func (manager *Manager) RemoveBase(bitboxBaseID string) {
	defer manager.mutex.Lock()()
	delete(manager.baseDeviceBitBoxBase, bitboxBaseID)
}

// GetDetectedBases returns bases detected by the manager with the mDNS scan.
func (manager *Manager) GetDetectedBases() map[string]string {
	return manager.detectedBases
}

// checkIfRemoved returns true if a bitboxbase was detected in, but is not reachable anymore.
func (manager *Manager) checkIfRemoved(bitboxBase *bitboxbase.BitBoxBase) bool {
	connected, err := bitboxBase.Ping()
	if err != nil || !connected {
		return true
	}
	return false
}

// mdnsScan scans the local network forever for BitBox Base devices.
func (manager *Manager) mdnsScan() {
	for {
		entries := make(chan *micromdns.ServiceEntry)
		wg := sync.WaitGroup{}
		wg.Add(1)
		go func() {
			defer wg.Done()
			// Do not change this map to pointer types or anything else, the reflect.DeepEqual comparison below may break
			detectedBases := make(map[string]string)
			for entry := range entries {
				host := entry.Host
				resolvedHosts, err := net.LookupHost(host)
				if err != nil || len(resolvedHosts) == 0 {
					manager.log.WithError(err).Error("Failed to resolve hostname: ", host)
					continue
				}
				baseIPv4 := resolvedHosts[0] + ":" + strconv.Itoa(entry.Port)

				deviceInfo := BaseDeviceInfo{
					Hostname: host,
					IPv4:     baseIPv4,
				}

				// Inform the backend that a new Base has been detected
				// Even though micromdns.Lookup is supposed to filter based on mDNS service, sometimes it
				// discovers other devices so we also filter them out here
				if _, ok := detectedBases[deviceInfo.Hostname]; !ok && strings.Contains(entry.Name, service) {
					detectedBases[deviceInfo.Hostname] = deviceInfo.IPv4
				}
			}
			if !reflect.DeepEqual(detectedBases, manager.detectedBases) {
				manager.detectedBases = detectedBases
				manager.onDetect()
			}
		}()

		// Start mdns lookup with custom params
		params := &micromdns.QueryParam{
			Service:             service,
			Domain:              domain,
			Timeout:             discoveryDuration,
			Entries:             entries,
			WantUnicastResponse: false,
		}
		err := micromdns.Query(params)
		if err != nil {
			manager.log.WithError(err).Error("mDNS lookup failed for service: ", service)
		}

		// Close channel and wait for go routine to finish
		close(entries)
		wg.Wait()
		time.Sleep(time.Second)
	}
}

func (manager *Manager) resolveIP(ip string) string {
	IP, _, err := net.SplitHostPort(ip)
	if err != nil {
		manager.log.WithError(err).Error("Failed to split IP and port. Returning hostname as 'uninitialized'", err)
		return ""
	}
	hostname, err := net.LookupAddr(IP)
	if err != nil {
		manager.log.WithError(err).Error("Failed to resolve hostname from IP. Returning hostname as 'uninitialized'", err)
		return ""
	}
	manager.log.Printf("Resolved %s to %s", IP, hostname)
	return hostname[0]
}

func (manager *Manager) initPersistedBases() {
	for _, registeredBase := range manager.bbbConfig.RegisteredBases() {

		_, err := manager.TryMakeNewBase(registeredBase.BaseID)
		if err != nil {
			manager.log.WithError(err).Errorf("Failed to reinitialize persisted BitBoxBase with ID: %s, hostname: %s", registeredBase.BaseID, registeredBase.Hostname)
			continue
		}
		func() {
			defer manager.mutex.RLock()()
			manager.baseDeviceBitBoxBase[registeredBase.BaseID].SetLocalHostname(registeredBase.Hostname)
		}()
	}
}

// Start starts a continuous mDNS scan for BitBox Base devices on local network.
func (manager *Manager) Start() {
	go manager.initPersistedBases()
	go manager.mdnsScan()
}

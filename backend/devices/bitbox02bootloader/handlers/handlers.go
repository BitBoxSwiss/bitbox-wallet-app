// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox02bootloader"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// BitBox02Bootloader models the API of the bitbox02 package.
type BitBox02Bootloader interface {
	Status() *bitbox02bootloader.Status
	UpgradeFirmware() error
	Reboot() error
	ShowFirmwareHashEnabled() (bool, error)
	SetShowFirmwareHashEnabled(bool) error
	Info() (*bitbox02bootloader.Info, error)
	ScreenRotate() error
}

// Handlers provides a web API to the Bitbox.
type Handlers struct {
	device BitBox02Bootloader
	log    *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) interface{}) *mux.Route,
	log *logrus.Entry,
) *Handlers {
	handlers := &Handlers{log: log.WithField("device", "bitbox02-bootloader")}

	handleFunc("/upgrade-firmware", handlers.postUpgradeFirmwareHandler).Methods("POST")
	handleFunc("/reboot", handlers.postRebootHandler).Methods("POST")
	handleFunc("/show-firmware-hash-enabled", handlers.getShowFirmwareHashEnabledHandler).Methods("GET")
	handleFunc("/set-firmware-hash-enabled", handlers.postSetShowFirmwareHashEnabledHandler).Methods("POST")
	handleFunc("/info", handlers.getInfoHandler).Methods("GET")
	handleFunc("/screen-rotate", handlers.postScreenRotateHandler).Methods("POST")

	return handlers
}

// Init installs a bitbox02 bootloader as a base for the web api. This needs to be called before any
// requests are made.
func (handlers *Handlers) Init(device BitBox02Bootloader) {
	handlers.log.Debug("Init")
	handlers.device = device
}

// Uninit removes the bitbox. After this, not requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.log.Debug("Uninit")
	handlers.device = nil
}

type bootloaderResponse struct {
	Success      bool   `json:"success"`
	ErrorMessage string `json:"errorMessage,omitempty"`
}

func (handlers *Handlers) errorResponse(err error) bootloaderResponse {
	handlers.log.WithError(err).Error("BitBox02 bootloader request failed")
	return bootloaderResponse{Success: false, ErrorMessage: err.Error()}
}

func (handlers *Handlers) postUpgradeFirmwareHandler(_ *http.Request) interface{} {
	if err := handlers.device.UpgradeFirmware(); err != nil {
		return handlers.errorResponse(err)
	}
	return bootloaderResponse{Success: true}
}

func (handlers *Handlers) postRebootHandler(_ *http.Request) interface{} {
	if err := handlers.device.Reboot(); err != nil {
		return handlers.errorResponse(err)
	}
	return bootloaderResponse{Success: true}
}

func (handlers *Handlers) getShowFirmwareHashEnabledHandler(_ *http.Request) interface{} {
	type response struct {
		Success bool `json:"success"`
		Enabled bool `json:"enabled"`
	}

	enabled, err := handlers.device.ShowFirmwareHashEnabled()
	if err != nil {
		return handlers.errorResponse(err)
	}
	return response{Success: true, Enabled: enabled}
}

func (handlers *Handlers) postSetShowFirmwareHashEnabledHandler(r *http.Request) interface{} {
	var enabled bool
	if err := json.NewDecoder(r.Body).Decode(&enabled); err != nil {
		return bootloaderResponse{Success: false, ErrorMessage: err.Error()}
	}
	if err := handlers.device.SetShowFirmwareHashEnabled(enabled); err != nil {
		return handlers.errorResponse(err)
	}
	return bootloaderResponse{Success: true}
}

func (handlers *Handlers) getInfoHandler(_ *http.Request) interface{} {
	type response struct {
		Success bool                     `json:"success"`
		Info    *bitbox02bootloader.Info `json:"info,omitempty"`
	}

	info, err := handlers.device.Info()
	if err != nil {
		return handlers.errorResponse(err)
	}
	return response{Success: true, Info: info}
}

func (handlers *Handlers) postScreenRotateHandler(_ *http.Request) interface{} {
	if err := handlers.device.ScreenRotate(); err != nil {
		return handlers.errorResponse(err)
	}
	return bootloaderResponse{Success: true}
}

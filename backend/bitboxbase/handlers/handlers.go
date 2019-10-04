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

package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/rpcmessages"
	bitboxbasestatus "github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/status"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

//Base models the api of the base middleware
type Base interface {
	MiddlewareInfo() (rpcmessages.SampleInfoResponse, error)
	VerificationProgress() (rpcmessages.VerificationProgressResponse, error)
	ConnectElectrum() error
	Status() bitboxbasestatus.Status
	ChannelHash() (string, bool)
	Deregister() error
	ReindexBitcoin() error
	ResyncBitcoin() error
	GetHostname() (string, error)
	SetHostname(string) error
	UserAuthenticate(string, string) error
	UserChangePassword(string, string) error
	MountFlashdrive() error
	UnmountFlashdrive() error
	BackupSysconfig() error
	BackupHSMSecret() error
	RestoreSysconfig() error
	RestoreHSMSecret() error
}

// Handlers provides a web API to the Bitbox.
type Handlers struct {
	base Base
	log  *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route,
	log *logrus.Entry,
) *Handlers {
	handlers := &Handlers{log: log.WithField("bitboxbase", "base")}

	handleFunc("/status", handlers.getStatusHandler).Methods("GET")
	handleFunc("/gethostname", handlers.getHostnameHandler).Methods("GET")
	handleFunc("/channel-hash", handlers.getChannelHashHandler).Methods("GET")
	handleFunc("/middlewareinfo", handlers.getMiddlewareInfoHandler).Methods("GET")
	handleFunc("/verificationprogress", handlers.getVerificationProgressHandler).Methods("GET")

	handleFunc("/mountflashdrive", handlers.postMountFlashdriveHandler).Methods("POST")
	handleFunc("/unmountflashdrive", handlers.postUnmountFlashdriveHandler).Methods("POST")
	handleFunc("/backupsysconfig", handlers.postBackupSysconfigHandler).Methods("POST")
	handleFunc("/backuphsmsecret", handlers.postBackupHSMSecretHandler).Methods("POST")
	handleFunc("/restoresysconfig", handlers.postRestoreSysconfigHandler).Methods("POST")
	handleFunc("/restorehsmsecret", handlers.postRestoreHSMSecretHandler).Methods("POST")
	handleFunc("/resyncbitcoin", handlers.postResyncBitcoinHandler).Methods("POST")
	handleFunc("/reindexbitcoin", handlers.postReindexBitcoinHandler).Methods("POST")
	handleFunc("/userauthenticate", handlers.postUserAuthenticate).Methods("POST")
	handleFunc("/userchangepassword", handlers.postUserChangePassword).Methods("POST")
	handleFunc("/sethostname", handlers.postSetHostname).Methods("POST")
	handleFunc("/disconnect", handlers.postDisconnectBaseHandler).Methods("POST")
	handleFunc("/connect-electrum", handlers.postConnectElectrumHandler).Methods("POST")

	return handlers
}

// Init installs a bitboxbase as a base for the web api. This needs to be called before any requests
// are made.
func (handlers *Handlers) Init(base Base) {
	handlers.log.Debug("Init")
	handlers.base = base
}

// Uninit removes the bitboxbase. After this, no requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.log.Debug("Uninit")
	handlers.base = nil
}

func bbBaseError(err error, log *logrus.Entry) map[string]interface{} {
	log.WithError(err).Error("Received an error from BitBox Base.")
	if bbBaseError, ok := errp.Cause(err).(*rpcmessages.ErrorResponse); ok {
		return map[string]interface{}{
			"success": false,
			"code":    bbBaseError.Code,
			"message": bbBaseError.Message,
		}
	}
	return map[string]interface{}{
		"success": false,
	}
}

func (handlers *Handlers) postDisconnectBaseHandler(r *http.Request) (interface{}, error) {
	handlers.log.Println("Disconnecting base...")
	err := handlers.base.Deregister()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) getStatusHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Println("Sending Status: ", handlers.base.Status())
	return map[string]interface{}{"status": handlers.base.Status()}, nil
}

func (handlers *Handlers) getChannelHashHandler(_ *http.Request) (interface{}, error) {
	hash, bitboxBaseVerified := handlers.base.ChannelHash()
	return map[string]interface{}{
		"hash":               hash,
		"bitboxBaseVerified": bitboxBaseVerified,
	}, nil
}

func (handlers *Handlers) getMiddlewareInfoHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Block Info")
	middlewareInfo, err := handlers.base.MiddlewareInfo()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success":        true,
		"middlewareInfo": middlewareInfo,
	}, nil
}

func (handlers *Handlers) getHostnameHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("getHostnameHandler")
	hostname, err := handlers.base.GetHostname()
	if err != nil {
		return bbBaseError(err, handlers.log), err
	}
	return map[string]interface{}{
		"success":  true,
		"hostname": hostname,
	}, nil
}

func (handlers *Handlers) postMountFlashdriveHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("postMountFlashdriveHandler")
	err := handlers.base.MountFlashdrive()
	if err != nil {
		return bbBaseError(err, handlers.log), err
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) postUnmountFlashdriveHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("postUnmountFlashdriveHandler")
	err := handlers.base.UnmountFlashdrive()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) postBackupSysconfigHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("postBackupSysconfigHandler")
	err := handlers.base.BackupSysconfig()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) postBackupHSMSecretHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("postBackupHSMSecretHandler")
	err := handlers.base.BackupHSMSecret()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) postRestoreSysconfigHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("postRestoreSysconfigHandler")
	err := handlers.base.RestoreSysconfig()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) postRestoreHSMSecretHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("postRestoreHSMSecretHandler")
	err := handlers.base.RestoreHSMSecret()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) postUserAuthenticate(r *http.Request) (interface{}, error) {
	payload := struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	err := handlers.base.UserAuthenticate(payload.Username, payload.Password)
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) postUserChangePassword(r *http.Request) (interface{}, error) {
	payload := struct {
		Username    string `json:"username"`
		NewPassword string `json:"newPassword"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return bbBaseError(err, handlers.log), nil
	}

	err := handlers.base.UserChangePassword(payload.Username, payload.NewPassword)
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) postSetHostname(r *http.Request) (interface{}, error) {
	payload := struct {
		Hostname string `json:"hostname"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	err := handlers.base.SetHostname(payload.Hostname)
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) getVerificationProgressHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("Verification Progress")
	verificationProgress, err := handlers.base.VerificationProgress()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success":              true,
		"verificationProgress": verificationProgress,
	}, nil
}

func (handlers *Handlers) postConnectElectrumHandler(_ *http.Request) (interface{}, error) {
	err := handlers.base.ConnectElectrum()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) postResyncBitcoinHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("postResyncBitcoinHandler")
	err := handlers.base.ResyncBitcoin()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

func (handlers *Handlers) postReindexBitcoinHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Debug("postReindexBitcoinHandler")
	err := handlers.base.ReindexBitcoin()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": true,
	}, nil
}

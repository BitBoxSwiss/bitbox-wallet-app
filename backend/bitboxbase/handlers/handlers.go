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

	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/rpcmessages"
	bitboxbasestatus "github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/status"
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
	Deregister() (bool, error)
	SyncWithOption(bitboxbase.SyncOption) (bool, error)
	GetHostname() (string, error)
	SetHostname(string) (bool, error)
	UserAuthenticate(string, string) (bool, error)
	UserChangePassword(string, string) (bool, error)
	MountFlashdrive() (bool, error)
	UnmountFlashdrive() (bool, error)
	BackupSysconfig() (bool, error)
	BackupHSMSecret() (bool, error)
	RestoreSysconfig() (bool, error)
	RestoreHSMSecret() (bool, error)
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
	handleFunc("/gethostname", handlers.getGetHostnameHandler).Methods("GET")
	handleFunc("/channel-hash", handlers.getChannelHashHandler).Methods("GET")
	handleFunc("/mountflashdrive", handlers.getMountFlashdriveHandler).Methods("GET")
	handleFunc("/unmountflashdrive", handlers.getUnmountFlashdriveHandler).Methods("GET")
	handleFunc("/backupsysconfig", handlers.getBackupSysconfigHandler).Methods("GET")
	handleFunc("/backuphsmsecret", handlers.getBackupHSMSecretHandler).Methods("GET")
	handleFunc("/restoresysconfig", handlers.getRestoreSysconfigHandler).Methods("GET")
	handleFunc("/restorehsmsecret", handlers.getRestoreHSMSecretHandler).Methods("GET")
	handleFunc("/middlewareinfo", handlers.getMiddlewareInfoHandler).Methods("GET")
	handleFunc("/verificationprogress", handlers.getVerificationProgressHandler).Methods("GET")

	handleFunc("/userauthenticate", handlers.postUserAuthenticate).Methods("POST")
	handleFunc("/userchangepassword", handlers.postUserChangePassword).Methods("POST")
	handleFunc("/sethostname", handlers.postSetHostname).Methods("POST")
	handleFunc("/syncoption", handlers.postSyncOptionHandler).Methods("POST")
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
	log.WithField("bbBaseError", err.Error()).Warning("Received an error from BitBox Base")
	return map[string]interface{}{
		"success": false,
		"message": err.Error(),
	}
}

func (handlers *Handlers) postDisconnectBaseHandler(r *http.Request) (interface{}, error) {
	handlers.log.Println("Disconnecting base...")
	success, err := handlers.base.Deregister()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}

	return map[string]interface{}{"success": success}, nil
}

func (handlers *Handlers) getStatusHandler(_ *http.Request) (interface{}, error) {
	handlers.log.Println("Sending Status: ", handlers.base.Status())
	return map[string]interface{}{"status": handlers.base.Status()}, nil
}

func (handlers *Handlers) getChannelHashHandler(r *http.Request) (interface{}, error) {
	hash, bitboxBaseVerified := handlers.base.ChannelHash()
	return map[string]interface{}{
		"hash":               hash,
		"bitboxBaseVerified": bitboxBaseVerified,
	}, nil

}

func (handlers *Handlers) getMiddlewareInfoHandler(r *http.Request) (interface{}, error) {
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

func (handlers *Handlers) getGetHostnameHandler(r *http.Request) (interface{}, error) {
	handlers.log.Debug("getGetHostnameHandler")
	hostname, err := handlers.base.GetHostname()
	if err != nil {
		return bbBaseError(err, handlers.log), err
	}
	return map[string]interface{}{
		"success":  true,
		"hostname": hostname,
	}, nil
}

func (handlers *Handlers) getMountFlashdriveHandler(r *http.Request) (interface{}, error) {
	handlers.log.Debug("getMountFlashdriveHandler")
	success, err := handlers.base.MountFlashdrive()
	if err != nil {
		return bbBaseError(err, handlers.log), err
	}
	return map[string]interface{}{
		"success": success,
	}, nil
}

func (handlers *Handlers) getUnmountFlashdriveHandler(r *http.Request) (interface{}, error) {
	handlers.log.Debug("getUnmountFlashdriveHandler")
	success, err := handlers.base.UnmountFlashdrive()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": success,
	}, nil
}

func (handlers *Handlers) getBackupSysconfigHandler(r *http.Request) (interface{}, error) {
	handlers.log.Debug("getBackupSysconfigHandler")
	success, err := handlers.base.BackupSysconfig()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": success,
	}, nil
}

func (handlers *Handlers) getBackupHSMSecretHandler(r *http.Request) (interface{}, error) {
	handlers.log.Debug("getBackupHSMSecretHandler")
	success, err := handlers.base.BackupHSMSecret()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": success,
	}, nil
}

func (handlers *Handlers) getRestoreSysconfigHandler(r *http.Request) (interface{}, error) {
	handlers.log.Debug("getRestoreSysconfigHandler")
	success, err := handlers.base.RestoreSysconfig()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": success,
	}, nil
}

func (handlers *Handlers) getRestoreHSMSecretHandler(r *http.Request) (interface{}, error) {
	handlers.log.Debug("getRestoreHSMSecretHandler")
	success, err := handlers.base.RestoreHSMSecret()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{
		"success": success,
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
	success, err := handlers.base.UserAuthenticate(payload.Username, payload.Password)
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{"success": success}, nil
}

func (handlers *Handlers) postUserChangePassword(r *http.Request) (interface{}, error) {
	payload := struct {
		Username    string `json:"username"`
		NewPassword string `json:"newPassword"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return bbBaseError(err, handlers.log), nil
	}

	success, err := handlers.base.UserChangePassword(payload.Username, payload.NewPassword)
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{"success": success}, nil
}

func (handlers *Handlers) postSetHostname(r *http.Request) (interface{}, error) {
	payload := struct {
		Hostname string `json:"hostname"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return bbBaseError(err, handlers.log), nil
	}

	success, err := handlers.base.SetHostname(payload.Hostname)
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{"success": success}, nil
}

func (handlers *Handlers) getVerificationProgressHandler(r *http.Request) (interface{}, error) {
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

func (handlers *Handlers) postConnectElectrumHandler(r *http.Request) (interface{}, error) {
	err := handlers.base.ConnectElectrum()
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{"success": true}, nil
}

func (handlers *Handlers) postSyncOptionHandler(r *http.Request) (interface{}, error) {
	payload := struct {
		Option bitboxbase.SyncOption `json:"option"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return bbBaseError(err, handlers.log), nil
	}

	success, err := handlers.base.SyncWithOption(payload.Option)
	if err != nil {
		return bbBaseError(err, handlers.log), nil
	}
	return map[string]interface{}{"success": success}, nil
}

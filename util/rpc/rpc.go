// Copyright 2018 Shift Devices AG
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

package rpc

import (
	"io"
)

// Status is the connection status to the blockchain node
type Status int

const (
	// CONNECTED indicates that we are online
	CONNECTED Status = iota
	// DISCONNECTED indicates that we are offline
	DISCONNECTED
)

// ServerInfo holds information about the backend server(s).
type ServerInfo struct {
	Server  string `json:"server"`
	TLS     bool   `json:"tls"`
	PEMCert string `json:"pemCert"`
}

// Backend describes the methods provided to connect to an RPC backend
type Backend interface {
	EstablishConnection() (io.ReadWriteCloser, error)
	ServerInfo() *ServerInfo
}

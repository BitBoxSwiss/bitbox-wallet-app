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

// Client describes the methods needed to communicate with an RPC server.
type Client interface {
	Method(func([]byte) error, func() func(), string, ...interface{})
	MethodSync(interface{}, string, ...interface{}) error
	SubscribeNotifications(string, func([]byte))
	Close()
	IsClosed() bool
	RegisterHeartbeat(string, ...interface{})
	OnConnect(func() error)
	ConnectionStatus() Status
	RegisterOnConnectionStatusChangedEvent(func(Status))
}

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

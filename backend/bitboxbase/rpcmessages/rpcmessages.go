package rpcmessages

import "fmt"

/*
Put notification constants here. Notifications for new rpc data should have the format 'OpUCanHas' + 'RPC Method Name'.
*/
const (
	// OpRPCCall is prepended to every rpc response messages, to indicate that the message is rpc response and not a notification.
	OpRPCCall = "r"
	// OpUCanHasSampleInfo notifies when new SampleInfo data is available.
	OpUCanHasSampleInfo = "d"
	// OpUCanHasVerificationProgress notifies when new VerificationProgress data is available.
	OpUCanHasVerificationProgress = "v"
)

/*
Put Incoming Args below this line. They should have the format of 'RPC Method Name' + 'Args'.
*/

// UserAuthenticateArgs is an struct that holds the arguments for the UserAuthenticate RPC call
type UserAuthenticateArgs struct {
	Username string
	Password string
}

// UserChangePasswordArgs is an struct that holds the arguments for the UserChangePassword RPC call
type UserChangePasswordArgs struct {
	Username    string
	NewPassword string
}

// SetHostnameArgs is a struct that holds the to be set hostname
type SetHostnameArgs struct {
	Hostname string
}

// SetRootPasswordArgs is a struct that holds the to be set root password
type SetRootPasswordArgs struct {
	RootPassword string
}

// ToggleSettingArgs is a generic message for settings that can be enabled or disabled
type ToggleSettingArgs struct {
	ToggleSetting bool
}

/*
Put Response structs below this line. They should have the format of 'RPC Method Name' + 'Response'.
*/

// GetEnvResponse is the struct that gets sent by the rpc server during a GetSystemEnv call
type GetEnvResponse struct {
	Network        string
	ElectrsRPCPort string
}

// SampleInfoResponse holds sample information from c-lightning and bitcoind. It is temporary for testing purposes
type SampleInfoResponse struct {
	Blocks         int64   `json:"blocks"`
	Difficulty     float64 `json:"difficulty"`
	LightningAlias string  `json:"lightningAlias"`
}

// VerificationProgressResponse is the struct that gets sent by the rpc server during a VerificationProgress rpc call
type VerificationProgressResponse struct {
	Blocks               int64   `json:"blocks"`
	Headers              int64   `json:"headers"`
	VerificationProgress float64 `json:"verificationProgress"`
}

// GetBaseInfoResponse is the struct that get sent by the rpc server during a GetBaseInfo rpc call
type GetBaseInfoResponse struct {
	ErrorResponse       *ErrorResponse
	Status              string `json:"status"`
	Hostname            string `json:"hostname"`
	MiddlewareLocalIP   string `json:"middlewareLocalIP"`
	MiddlewareLocalPort string `json:"middlewareLocalPort"`
	MiddlewareTorOnion  string `json:"middlewareTorOnion"`
	MiddlewareTorPort   string `json:"middlewareTorPort"`
	IsTorEnabled        bool   `json:"isTorEnabled"`
	IsBitcoindListening bool   `json:"isBitcoindListening"`
	FreeDiskspace       int64  `json:"freeDiskspace"`  // in Byte
	TotalDiskspace      int64  `json:"totalDiskspace"` // in Byte
	BaseVersion         string `json:"baseVersion"`
	BitcoindVersion     string `json:"bitcoindVersion"`
	LightningdVersion   string `json:"lightningdVersion"`
	ElectrsVersion      string `json:"electrsVersion"`
}

// ErrorResponse is a generic RPC response indicating if a RPC call was successful or not.
// It can be embedded into other RPC responses that return values.
// In any case the ErrorResponse should be checked first, so that, if an error is returned, we ignore everything else in the response.
type ErrorResponse struct {
	Success bool
	Code    ErrorCode
	Message string
}

// Error formats the ErrorResponse in the following two formats:
// If no error occoured:
//  ErrorResponse: Success: true
//
// If an error occoured:
// 	ErrorResponse:
// 		Success: false
// 		Code: <ERROR_CODE>
//		Message: <message>
func (err *ErrorResponse) Error() string {
	if err.Success {
		return fmt.Sprintf("ErrorResponse: Success: %t \n", err.Success)
	}
	return fmt.Sprintf("ErrorResponse:\n\tSuccess: %t \n\tCode: %s \n\tMessage: %s\n", err.Success, err.Code, err.Message)
}

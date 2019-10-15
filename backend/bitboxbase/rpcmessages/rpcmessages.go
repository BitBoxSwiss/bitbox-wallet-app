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
	// OpServiceInfoChanged notifies when the GetServiceInfo data changed.
	OpServiceInfoChanged = "s"
	// OpBaseUpdateProgressChanged notifies when the BaseUpdateProgress changes while performing a Base Update.
	OpBaseUpdateProgressChanged = "u"
)

/*
Put Incoming Args below this line. They should have the format of 'RPC Method Name' + 'Args'.
*/

// UserAuthenticateArgs is a struct that holds the arguments for the UserAuthenticate RPC call
type UserAuthenticateArgs struct {
	Username string
	Password string
}

// AuthGenericRequest is a struct that acts as a generic request struct
type AuthGenericRequest struct {
	Token string
}

// UserChangePasswordArgs is an struct that holds the arguments for the UserChangePassword RPC call
type UserChangePasswordArgs struct {
	Username    string
	Password    string
	NewPassword string
	Token       string
}

// SetHostnameArgs is a struct that holds the to be set hostname
type SetHostnameArgs struct {
	Hostname string
	Token    string
}

// SetRootPasswordArgs is a struct that holds the to be set root password
type SetRootPasswordArgs struct {
	RootPassword string
	Token        string
}

// ToggleSettingArgs is a generic message for settings that can be enabled or disabled
type ToggleSettingArgs struct {
	ToggleSetting bool
	Token         string
}

// UpdateBaseArgs is a struct that holds the Base version that should be updated to
type UpdateBaseArgs struct {
	Version string
	Token   string
}

/*
Put Response structs below this line. They should have the format of 'RPC Method Name' + 'Response'.
*/

// SetupStatusResponse is the struct that gets sent by the rpc server during a SetupStatus rpc call.
// This call is not authenticated and serves as indicator for what to show during the base setup wizzard.
type SetupStatusResponse struct {
	MiddlewarePasswordSet bool
	BaseSetup             bool
}

// UserAuthenticateResponse is the struct that gets sent by the rpc server during a UserAuthenticate call. It contains the session's jwt token.
type UserAuthenticateResponse struct {
	ErrorResponse *ErrorResponse
	Token         string
}

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

// BaseUpdateState is the type used to hold the current state for a Base update.
type BaseUpdateState int

// The possible values of BaseUpdateState.
// Representing the states that can be reached in a BaseUpdate RPC call.
const (
	UpdateNotInProgress BaseUpdateState = iota + 1
	UpdateDownloading
	UpdateFailed
	UpdateApplying
	UpdateRebooting
)

// GetBaseUpdateProgressResponse is the response to a GetBaseUpdateProgress RPC call.
// The app is notified over a changed middleware state calls the GetBaseUpdateProgress
// RPC which returns GetBaseUpdateProgressResponse.
type GetBaseUpdateProgressResponse struct {
	ErrorResponse         *ErrorResponse
	State                 BaseUpdateState
	ProgressPercentage    int
	ProgressDownloadedKiB int
}

// GetBaseInfoResponse is the struct that gets sent by the RPC server during a GetBaseInfo RPC call
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

// GetServiceInfoResponse is the struct that gets sent by the RPC server during a GetServiceInfo RPC call
type GetServiceInfoResponse struct {
	ErrorResponse                *ErrorResponse `json:"errorResponse"`
	BitcoindBlocks               int64          `json:"bitcoindBlocks"`
	BitcoindHeaders              int64          `json:"bitcoindHeaders"`
	BitcoindVerificationProgress float64        `json:"bitcoindVerificationProgress"`
	BitcoindPeers                int64          `json:"bitcoindPeers"`
	BitcoindIBD                  bool           `json:"bitcoindIBD"`
	LightningdBlocks             int64          `json:"lightningdBlocks"`
	ElectrsBlocks                int64          `json:"electrsBlocks"`
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
// If no error occurred:
//  ErrorResponse: Success: true
//
// If an error occurred:
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

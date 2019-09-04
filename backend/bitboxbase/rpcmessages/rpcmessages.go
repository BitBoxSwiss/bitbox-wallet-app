package rpcmessages

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

// GetHostnameResponse is the struct that get sent by the rpc server during a GetHostname rpc call
type GetHostnameResponse struct {
	ErrorResponse
	Hostname string
}

// ErrorResponse is a generic RPC response indicating if a RPC call was successful or not.
// It can be embedded into other RPC responses that return values.
// In any case the ErrorResponse should be checked first, so that, if an error is returned, we ignore everything else in the response.
type ErrorResponse struct {
	Success bool
	Code    string
	Message string
}

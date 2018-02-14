package bitbox

// Status represents the device status.
type Status string

const (
	// StatusUninitialized is the uninitialized device, i.e. unseeded and no password set.
	// Use SetPassword() to proceed to StatusLoggedIn.
	StatusUninitialized Status = "uninitialized"

	// StatusInitialized means the password was set and the device was seeded. Use Login() to
	// proceed to StatusSeeded.
	StatusInitialized Status = "initialized"

	// StatusLoggedIn means device authentication was successful, but the device is not yet
	// seeded. Use CreateWallet() or RestoreBackup() to seed and proceed to StatusSeeded.
	StatusLoggedIn Status = "logged_in"

	// StatusSeeded means we are authenticated, and the device is seeded. We are ready to use
	// XPub(), Sign() etc.
	StatusSeeded Status = "seeded"
)

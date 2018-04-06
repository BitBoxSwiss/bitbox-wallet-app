package relay

// Channel models an encrypted communication channel between the desktop and the paired mobile.
type Channel interface {
	// GetChannelID returns the unique identifier of the channel between the communication parties.
	GetChannelID() string

	// GetEncryptionKey is used to encrypt the communication between the desktop and the mobile.
	GetEncryptionKey() []byte
}

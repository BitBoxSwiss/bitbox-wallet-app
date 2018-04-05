package relay

// Channel models an encrypted communication channel between the desktop and the paired mobile.
type Channel interface {
	// ChannelID returns the unique identifier of the channel between the communication parties.
	ChannelID() string

	// EncryptionKey is used to encrypt the communication between the desktop and the mobile.
	EncryptionKey() []byte
}

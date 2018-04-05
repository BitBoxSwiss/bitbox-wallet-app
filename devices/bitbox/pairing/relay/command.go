package relay

// command enumerates the commands that can be sent to the relay server.
type command string

const (
	// Pushes a message for the other communication party to the relay server on the given channel.
	pushMessageCommand command = "data"

	// Pulls the relay server for an incoming message on the specified channel for the specified
	// communication party. If there are several messages, only the oldest message is returned.
	// The relay server waits up to 10 seconds before returning no message at all.
	pullOldestMessageCommand command = "gd"

	// Deletes on the relay server all messages in all channels which expired.
	// In the default script, messages expire 40 seconds after their creation.
	deleteAllMessagesCommand command = "dd"
)

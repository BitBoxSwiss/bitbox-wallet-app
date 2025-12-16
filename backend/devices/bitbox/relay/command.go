// SPDX-License-Identifier: Apache-2.0

package relay

// Command enumerates the commands that can be sent to the relay server.
type Command string

const (
	// PushMessageCommand pushes a message for the other communication party on the given channel.
	PushMessageCommand Command = "data"

	// PullOldestMessageCommand pulls the oldest message on the specified channel for the specified
	// communication party. If there are several messages, only the oldest message is returned.
	// The relay server waits up to 10 seconds before returning no message at all.
	PullOldestMessageCommand Command = "gd"

	// DeleteAllMessagesCommand deletes all messages in all channels which expired.
	// In the default script, messages expire 40 seconds after their creation.
	DeleteAllMessagesCommand Command = "dd"
)

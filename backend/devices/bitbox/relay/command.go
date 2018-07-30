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

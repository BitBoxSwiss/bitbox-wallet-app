// SPDX-License-Identifier: Apache-2.0

package relay

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// request models a request to the relay server.
type request struct {
	// The relay server to which the request is sent.
	server Server

	// The command to be executed by the relay server. It acts like an API endpoint.
	command Command

	// The sender does not matter if the command is 'deleteAllMessagesCommand'.
	sender Party

	// The channel may only be nil if the command is 'deleteAllMessagesCommand'.
	channel *Channel

	// The encrypted content which is sent to the other communication party.
	// This field may not be nil if the command is 'pushMessageCommand'.
	content *string
}

// encode encodes the request to be transmitted to the relay server.
// Please note that 'url.Values' escapes certain characters and thus cannot be used here.
func (request *request) encode() string {
	var buffer bytes.Buffer

	buffer.WriteString("c=") // command
	buffer.WriteString(string(request.command))

	buffer.WriteString("&dt=") // device type
	buffer.WriteString(request.sender.Encode())

	if request.channel != nil {
		buffer.WriteString("&uuid=") // universally unique identifier
		buffer.WriteString(request.channel.ChannelID)
	}

	if request.content != nil {
		buffer.WriteString("&pl=") // payload
		buffer.WriteString(*request.content)
	}

	return buffer.String()
}

// send sends the request to the relay server and returns its response.
func (request *request) send() (*response, error) {
	httpClient, err := request.channel.socksProxy.GetHTTPClient()
	if err != nil {
		return nil, err
	}
	httpResponse, err := httpClient.Post(
		string(request.server),
		"application/x-www-form-urlencoded",
		strings.NewReader(request.encode()),
	)
	if err != nil {
		return nil, err
	}
	if httpResponse.StatusCode != http.StatusOK {
		return nil, errp.New("Proxy Server did not respond with OK http status code, it is probably offline")
	}
	defer func() { _ = httpResponse.Body.Close() }()
	body, err := io.ReadAll(httpResponse.Body)
	if err != nil {
		return nil, err
	}
	var serverResponse response
	err = json.Unmarshal(body, &serverResponse)
	return &serverResponse, err
}

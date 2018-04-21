package relay

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
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
	fmt.Println("Sending:", request.encode())
	httpResponse, err := http.Post(
		string(request.server),
		"application/x-www-form-urlencoded",
		strings.NewReader(request.encode()),
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = httpResponse.Body.Close() }()
	body, err := ioutil.ReadAll(httpResponse.Body)
	if err != nil {
		return nil, err
	}
	var serverResponse response
	err = json.Unmarshal(body, &serverResponse)
	return &serverResponse, err
}

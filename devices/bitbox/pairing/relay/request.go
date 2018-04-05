package relay

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"
)

// request models a request to the relay server.
type request struct {
	// The relay server to which the request is sent.
	server Server

	// The command to be executed by the relay server. It acts like an API endpoint.
	command command

	// The sender does not matter if the command is 'deleteAllMessagesCommand'.
	sender party

	// The channel may only be nil if the command is 'deleteAllMessagesCommand'.
	channel Channel

	// The encrypted content which is sent to the other communication party.
	// This field may not be nil if the command is 'pushMessageCommand'.
	content *string
}

func (request *request) String() string {
	var buffer bytes.Buffer

	buffer.WriteString("c=") // command
	buffer.WriteString(string(request.command))

	buffer.WriteString("&dt=") // device type
	buffer.WriteString(string(request.sender))

	if request.channel != nil {
		buffer.WriteString("&uuid=") // universally unique identifier
		buffer.WriteString(request.channel.ChannelID())
	}

	if request.content != nil {
		buffer.WriteString("&pl=") // payload
		buffer.WriteString(*request.content)
	}

	return buffer.String()
}

func (request *request) send() (*response, error) {
	httpResponse, err := http.Post(string(request.server), "text/plain", strings.NewReader(request.String()))
	if err != nil {
		return nil, err
	}
	defer httpResponse.Body.Close()
	body, err := ioutil.ReadAll(httpResponse.Body)
	if err != nil {
		return nil, err
	}
	var response response
	err = json.Unmarshal(body, &response)
	return &response, err
}

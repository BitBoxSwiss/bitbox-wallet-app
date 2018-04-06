package relay

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"
)

// Request models a request to the relay server.
type Request struct {
	// The relay server to which the request is sent.
	server Server

	// The command to be executed by the relay server. It acts like an API endpoint.
	command Command

	// The sender does not matter if the command is 'deleteAllMessagesCommand'.
	sender Party

	// The channel may only be nil if the command is 'deleteAllMessagesCommand'.
	channel Channel

	// The encrypted content which is sent to the other communication party.
	// This field may not be nil if the command is 'pushMessageCommand'.
	content *string
}

// NewRequest returns a new request with the given arguments.
func NewRequest(
	server Server,
	command Command,
	sender Party,
	channel Channel,
	content *string,
) *Request {
	return &Request{
		server:  server,
		command: command,
		sender:  sender,
		channel: channel,
		content: content,
	}
}

// Encode encodes the request to be transmitted to the relay server.
// Please note that 'url.Values' escapes certain characters and thus cannot be used here.
func (request *Request) Encode() string {
	var buffer bytes.Buffer

	buffer.WriteString("c=") // command
	buffer.WriteString(string(request.command))

	buffer.WriteString("&dt=") // device type
	buffer.WriteString(string(request.sender))

	if request.channel != nil {
		buffer.WriteString("&uuid=") // universally unique identifier
		buffer.WriteString(request.channel.GetChannelID())
	}

	if request.content != nil {
		buffer.WriteString("&pl=") // payload
		buffer.WriteString(*request.content)
	}

	return buffer.String()
}

// Send sends the request to the relay server and returns its response.
func (request *Request) Send() (*Response, error) {
	httpResponse, err := http.Post(
		string(request.server),
		"application/x-www-form-urlencoded",
		strings.NewReader(request.Encode()),
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = httpResponse.Body.Close() }()
	body, err := ioutil.ReadAll(httpResponse.Body)
	if err != nil {
		return nil, err
	}
	var response Response
	err = json.Unmarshal(body, &response)
	return &response, err
}

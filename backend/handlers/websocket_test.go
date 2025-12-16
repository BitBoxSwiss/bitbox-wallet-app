// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func createWebsocketConn(t *testing.T) (client, server *websocket.Conn, cleanup func()) {
	t.Helper()

	// Start a dummy server, simulating the app's backend.
	// chConn will have at most one item and then closed.
	chConn := make(chan *websocket.Conn)
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(chConn)
		var upgrader websocket.Upgrader
		wsConn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("websocket upgrade: %v", err)
			return
		}
		chConn <- wsConn
	}))

	// Setup a dummy websocket client, simulating the app's frontend.
	url := "ws:" + strings.TrimPrefix(testServer.URL, "http:")
	clientConn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		testServer.Close()
		t.Fatalf("websocket dialer: %v", err)
	}

	// Wait for the client to connect to the dummy backend server.
	var serverConn *websocket.Conn
	select {
	case conn := <-chConn:
		if conn == nil {
			testServer.Close()
			t.Fatal("couldn't upgrade HTTP to websocket")
		}
		serverConn = conn
	case <-time.After(time.Second):
		testServer.Close()
		t.Fatal("websocket client took too long to connect")
	}

	return clientConn, serverConn, testServer.Close
}

func TestRunWebsocket(t *testing.T) {
	t.Parallel()
	client, server, cleanup := createWebsocketConn(t)
	defer cleanup()

	// Share all received messages from the client over a channel
	// until the connection is gone, at which point close messages.
	messages := make(chan []byte)
	go func() {
		defer close(messages)
		for {
			_, msg, err := client.ReadMessage()
			if err != nil {
				t.Logf("client.ReadMessage: %v", err)
				return
			}
			messages <- msg
		}
	}()

	cdata := &ConnectionData{token: "auth-token"}
	send, quit := runWebsocket(server, cdata, logrus.NewEntry(logrus.StandardLogger()))

	// Send a message to the queue but do not expect to receive it just yet
	// because the client hasn't been authorized.
	send <- []byte("before authz")
	select {
	case <-time.After(10 * time.Millisecond):
		// Ok: no messages before authz.
	case msg := <-messages:
		t.Errorf("received unexpected msg before authz: %q", msg)
	}

	// Authorize the client and send another message.
	authz := []byte("Authorization: Basic " + cdata.token)
	require.NoError(t, client.WriteMessage(websocket.TextMessage, authz))
	send <- []byte("after authz")

	// Expect to receive both messages now.
	// The values indicate whether a message has been received by the client.
	wantMsg := map[string]bool{
		"before authz": false,
		"after authz":  false,
	}
messagesLoop:
	for {
		select {
		case <-time.After(10 * time.Millisecond):
			// No more messages.
			break messagesLoop
		case msg := <-messages:
			alreadyReceived, expected := wantMsg[string(msg)]
			switch {
			case !expected:
				t.Errorf("received unexpected message: %q", msg)
			case expected && alreadyReceived:
				t.Errorf("received duplicated expected message: %q", msg)
			default:
				wantMsg[string(msg)] = true
			}

		}
	}
	for m, ok := range wantMsg {
		if !ok {
			t.Errorf("did not receive %q", m)
		}
	}

	// Close client's websocket conn and expect runWebsocket's quit
	// to be closed as well.
	require.NoError(t, client.Close())
	select {
	case <-quit:
		// ok
	case <-time.After(time.Second):
		t.Error("runWebsocket's quit took too long to close")
	}
}

func TestRunWebsocketNoAuthz(t *testing.T) {
	t.Parallel()
	client, server, cleanup := createWebsocketConn(t)
	defer cleanup()

	cdata := &ConnectionData{token: "auth-token"}
	_, quit := runWebsocket(server, cdata, logrus.NewEntry(logrus.StandardLogger()))
	if err := client.WriteMessage(websocket.TextMessage, []byte("no authz")); err != nil {
		t.Fatalf("client.WriteMessage: %v", err)
	}

	select {
	case <-quit:
		// Ok: quit should be closed because no authz was sent.
	case <-time.After(time.Second):
		t.Error("runWebsocket's quit took too long to close")
	}

	cc := client.UnderlyingConn()
	require.NoError(t, cc.SetReadDeadline(time.Now().Add(time.Second)))
	b := []byte{0}
	if _, err := cc.Read(b); err != io.EOF {
		t.Errorf("client net conn is not closed; err: %v", err)
	}
}

func TestRunWebsocketCloseSend(t *testing.T) {
	t.Parallel()
	client, server, cleanup := createWebsocketConn(t)
	defer cleanup()

	cdata := &ConnectionData{token: "auth-token"}
	send, quit := runWebsocket(server, cdata, logrus.NewEntry(logrus.StandardLogger()))

	close(send)
	select {
	case <-quit:
		// Ok, runWebsocket is done.
	case <-time.After(time.Second):
		t.Errorf("runWebsocket's quit took too long to close")
	}

	require.NoError(t, client.SetReadDeadline(time.Now().Add(time.Second)))
	_, _, err := client.ReadMessage()
	if _, ok := err.(*websocket.CloseError); !ok {
		t.Errorf("client.ReadMessage: %v (%T); want *websocket.CloseError", err, err)
	}
}

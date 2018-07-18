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
)

func createWebsocketConn(t *testing.T) (client, server *websocket.Conn, cleanup func()) {
	t.Helper()

	// Start a dummy server, simulating godbb's backend.
	// chConn will have at most one *websocket.Conn item and then closed.
	chConn := make(chan *websocket.Conn)
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(chConn)
		var up websocket.Upgrader
		ws, err := up.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("websocket upgrade: %v", err)
			return
		}
		chConn <- ws
	}))

	// Setup a dummy websocket client, simulating godbb's frontend.
	u := "ws:" + strings.TrimPrefix(s.URL, "http:")
	clientConn, _, err := websocket.DefaultDialer.Dial(u, nil)
	if err != nil {
		s.Close()
		t.Fatalf("websocket dialer: %v", err)
	}

	// Wait for the client to connect to the dummy backend server.
	var serverConn *websocket.Conn
	select {
	case c := <-chConn:
		if c == nil {
			s.Close()
			t.Fatal("couldn't upgrade HTTP to websocket")
		}
		serverConn = c
	case <-time.After(time.Second):
		s.Close()
		t.Fatal("websocket client took too long to connect")
	}

	return clientConn, serverConn, s.Close
}

func TestRunWebsocket(t *testing.T) {
	client, server, cleanup := createWebsocketConn(t)
	defer cleanup()

	// Share all received messages from the client over recv
	// until the connection is gone.
	recv := make(chan []byte, 1)
	go func() {
		for {
			_, b, err := client.ReadMessage()
			if err != nil {
				t.Logf("client.ReadMessage: %v", err)
				return
			}
			recv <- b
		}
	}()

	cdata := &ConnectionData{token: "auth-token"}
	send, quit := runWebsocket(server, cdata, logrus.NewEntry(logrus.StandardLogger()))

	// Send a message to the queue but do not expect to receive it yet
	// because the client isn't authorized yet.
	send <- []byte("before authz")
	select {
	case b := <-recv:
		t.Errorf("recv unexpected msg before authz: %q", b)
	default:
		// Ok: no messages before authz.
	}

	// Authorize the client.
	a := []byte("Authorization: Basic " + cdata.token)
	if err := client.WriteMessage(websocket.TextMessage, a); err != nil {
		t.Fatalf("client.WriteMessage: %v", err)
	}
	// Send a second message.
	send <- []byte("after authz")

	// Expect to receive both messages now.
	wantMsg := map[string]bool{
		"before authz": false,
		"after authz":  false,
	}
recvLoop:
	for {
		select {
		case b := <-recv:
			if _, exists := wantMsg[string(b)]; !exists {
				t.Errorf("recv unexpected msg: %q", b)
				continue
			}
			wantMsg[string(b)] = true
		case <-time.After(100 * time.Millisecond):
			// No more messages.
			break recvLoop
		}
	}
	for m, ok := range wantMsg {
		if !ok {
			t.Errorf("did not receive %q", m)
		}
	}

	// Close client's websocket conn and expect runWebsocket's quit
	// to be closed as well.
	client.Close()
	select {
	case <-quit:
		// ok
	case <-time.After(time.Second):
		t.Fatal("runWebsocket's quit took too long to close")
	}
}

func TestRunWebsocketNoAuthz(t *testing.T) {
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
	cc.SetReadDeadline(time.Now().Add(time.Second))
	b := []byte{0}
	if _, err := cc.Read(b); err != io.EOF {
		t.Errorf("client conn is not closed; err: %v", err)
	}
}

func TestRunWebsocketCloseSend(t *testing.T) {
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

	client.SetReadDeadline(time.Now().Add(time.Second))
	_, _, err := client.ReadMessage()
	if !websocket.IsCloseError(err, websocket.CloseNoStatusReceived) {
		t.Errorf("client.ReadMessage: %v; want err type %v", err, websocket.CloseNoStatusReceived)
	}
}

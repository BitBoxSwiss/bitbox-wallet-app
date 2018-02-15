package handlers

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

// runWebsocket sets up loops for sending/receiving, abstracting away the low level details about
// pings, timeouts, connection closing, etc.  It returns two channels: one to send messages to the
// client, and one which notifies when the connection was closed.
func runWebsocket(conn *websocket.Conn) (chan []byte, <-chan struct{}) {
	// Time allowed to read the next pong message from the peer.
	const pongWait = 60 * time.Second
	// Send pings to peer with this period. Must be less than pongWait.
	const pingPeriod = time.Second
	// Time allowed to write a message to the peer.
	const writeWait = 10 * time.Second

	const maxMessageSize = 512

	quitChan := make(chan struct{})
	sendChan := make(chan []byte)

	readLoop := func() {
		defer func() {
			close(quitChan)
			_ = conn.Close()
		}()
		conn.SetReadLimit(maxMessageSize)
		_ = conn.SetReadDeadline(time.Now().Add(pongWait))
		conn.SetPongHandler(func(string) error {
			_ = conn.SetReadDeadline(time.Now().Add(pongWait))
			return nil
		})
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
					log.Println(err)
				}
				break
			}
		}
	}

	writeLoop := func() {
		ticker := time.NewTicker(pingPeriod)
		defer func() {
			ticker.Stop()
			_ = conn.Close()
		}()
		for {
			select {
			case message, ok := <-sendChan:
				_ = conn.SetWriteDeadline(time.Now().Add(writeWait))
				if !ok {
					_ = conn.WriteMessage(websocket.CloseMessage, []byte{})
					return
				}
				if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
					return
				}
			case <-ticker.C:
				_ = conn.SetWriteDeadline(time.Now().Add(writeWait))
				if err := conn.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
					return
				}
			}
		}
	}

	go readLoop()
	go writeLoop()

	return sendChan, quitChan
}

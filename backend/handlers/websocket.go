// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// runWebsocket sets up loops for sending/receiving, abstracting away the low level details about
// pings, timeouts, connection closing, etc.
// It returns two channels: one to send messages to the client, and one which notifies
// when the connection was closed.
//
// Closing msg makes runWebsocket's goroutines quit.
// The goroutines close conn upon exit, due to a send/receive error or when msg is closed.
// runWebsocket never closes msg.
func runWebsocket(conn *websocket.Conn, apiData *ConnectionData, log *logrus.Entry) (msg chan<- []byte, quit <-chan struct{}) {
	// Time allowed to read the next pong message from the peer.
	const pongWait = 60 * time.Second
	// Send pings to peer with this period. Must be less than pongWait.
	const pingPeriod = time.Second
	// Time allowed to write a message to the peer.
	const writeWait = 10 * time.Second

	const maxMessageSize = 512

	quitChan := make(chan struct{})
	sendChan := make(chan []byte)
	authorizedChan := make(chan struct{}, 1)

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
			_, msg, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
					log.WithFields(logrus.Fields{"group": "websocket", "error": err}).Error(err.Error())
				}
				break
			}
			if string(msg) != "Authorization: Basic "+apiData.token {
				log.Error("Expected authorization token as first message. Closing websocket.")
				_ = conn.Close()
				return
			}
			authorizedChan <- struct{}{}
		}
	}

	sendMessage := func(message []byte) error {
		_ = conn.SetWriteDeadline(time.Now().Add(writeWait))
		return conn.WriteMessage(websocket.TextMessage, message)
	}

	writeLoop := func() {
		ticker := time.NewTicker(pingPeriod)
		defer func() {
			ticker.Stop()
			_ = conn.Close()
		}()
		authorized := false
		var buffer [][]byte
		for {
			select {
			case <-authorizedChan:
				for _, message := range buffer {
					if err := sendMessage(message); err != nil {
						return
					}
				}
				authorized = true
			case message, ok := <-sendChan:
				if !ok {
					_ = conn.WriteMessage(websocket.CloseMessage, []byte{})
					return
				}
				if authorized {
					if sendMessage(message) != nil {
						return
					}
				} else {
					buffer = append(buffer, message)
				}
			case <-ticker.C:
				_ = conn.SetWriteDeadline(time.Now().Add(writeWait))
				if conn.WriteMessage(websocket.PingMessage, []byte{}) != nil {
					return
				}
			}
		}
	}

	go readLoop()
	go writeLoop()

	return sendChan, quitChan
}

// Copyright 2019 Shift Devices AG
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

//Package updater manages the connection with the bitboxbase, establishing a websocket listener and sending events when receiving packets.
package updater

import (
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"regexp"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// Updater implements observable blockchainInfo.
type Updater struct {
	observable.Implementation
	blockchainInfo string
	log            *logrus.Entry
	running        bool
}

// BlockInfo returns the last received blockchain information packet from the middleware
func (updater *Updater) BlockInfo() string {
	return updater.blockchainInfo
}

// NewUpdater returns a new bitboxbase updater.
func NewUpdater() *Updater {
	updater := &Updater{
		log: logging.Get().WithGroup("bitboxbase"),
	}
	return updater
}

//Connect start the websocket go routine, first checking if the middleware is reachable
func (updater *Updater) Connect(ip string, bitboxBaseID string) error {
	//TODO: This is where the initial rest call should go. The initial call initiates the noise authentication pairing.
	//This should not be asynchronous, the frontend should not show something until the pairing initiates
	simpleURL := url.URL{Scheme: "http", Host: ip, Path: "/"}
	response, err := http.Get(simpleURL.String())
	//defer response.Body.Close()
	if err != nil {
		updater.log.Println("No response from middleware", err)
		updater.running = false
		return err
	}
	if response.StatusCode != http.StatusOK {
		updater.log.Println("Received http status code from middleware other than 200")
		updater.running = false
		return err
	}

	bodyBytes, err := ioutil.ReadAll(response.Body)
	if err != nil {
		updater.running = false
		updater.log.Println("Body Bytes not read properly")
		return err
	}
	_, err = regexp.MatchString("OK!", string(bodyBytes))
	if err != nil {
		updater.running = false
		updater.log.Println("Unexpected Response Body Bytes")
		return errors.New("updater: Unexpected Response Body Bytes")
	}
	updater.running = true
	go listenWebsocket(updater, ip, bitboxBaseID)
	return nil
}

//Stop provides a setter for the running flag
func (updater *Updater) Stop() {
	updater.running = false
}

func listenWebsocket(updater *Updater, ip string, bitboxBaseID string) {
	u := url.URL{Scheme: "ws", Host: ip, Path: "/ws"}
	updater.log.Printf("connecting to %s", u.String())
	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		updater.log.Printf("Websocket dial failed: %s", err.Error())
	}
	// TODO: add proper error handling
	//defer c.Close()

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			updater.log.Println("read:", err)
			return
		}
		updater.blockchainInfo = string(message)
		updater.Notify(observable.Event{
			Subject: fmt.Sprintf("/bitboxbases/%s/blockinfo", bitboxBaseID),
			Action:  action.Replace,
			Object:  updater.blockchainInfo,
		})
		updater.log.Printf("Received blockinfo: %s , from id: %s", updater.blockchainInfo, bitboxBaseID)
		time.Sleep(time.Second)
		if !updater.running {
			return
		}
	}
}

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
	"regexp"

	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// BaseMiddlewareInfo holds some sample information from the BitBox Base
type BaseMiddlewareInfo struct {
	Blocks         int64   `json:"blocks"`
	Difficulty     float64 `json:"difficulty"`
	LightningAlias string  `json:"lightningAlias"`
}

// Updater implements observable blockchainInfo.
type Updater struct {
	observable.Implementation
	middlewareInfo *BaseMiddlewareInfo
	log            *logrus.Entry
	running        bool
	address        string
}

// MiddlewareInfo returns the last received blockchain information packet from the middleware
func (updater *Updater) MiddlewareInfo() interface{} {
	return updater.middlewareInfo
}

// NewUpdater returns a new bitboxbase updater.
func NewUpdater(address string) *Updater {
	updater := &Updater{
		log:            logging.Get().WithGroup("bitboxbase"),
		address:        address,
		middlewareInfo: &BaseMiddlewareInfo{},
		log:            logging.Get().WithGroup("bitboxbase"),
		address:        address,
	}
	return updater
}

//Connect start the websocket go routine, first checking if the middleware is reachable
func (updater *Updater) Connect(address string, bitboxBaseID string) error {
	//TODO: This is where the initial rest call should go. The initial call initiates the noise authentication pairing.
	//This should not be asynchronous, the frontend should not show something until the pairing initiates
	response, err := http.Get("http://" + address + "/")
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
	go listenWebsocket(updater, bitboxBaseID)
	return nil
}

//GetEnv makes an http GET request to the base and on success returns some environment data from the base such as the electrs port
func (updater *Updater) GetEnv() ([]byte, error) {
	response, err := http.Get("http://" + updater.address + "/getenv")
	if err != nil {
		updater.log.Error("GetEnv http GET request failed, unable to get information from BitBox Base")
		return nil, err
	}
	bodyBytes, err := ioutil.ReadAll(response.Body)
	if err != nil {
		updater.log.Error("GetEnv body bytes not read properly")
		return nil, err
	}
	return bodyBytes, err
}

// Stop provides a setter for the running flag
func (updater *Updater) Stop() {
	updater.running = false
}

func listenWebsocket(updater *Updater, bitboxBaseID string) {
	updater.log.Printf("connecting to base websocket")
	c, _, err := websocket.DefaultDialer.Dial("ws://"+updater.address+"/ws", nil)
	if err != nil {
		updater.log.Printf("Websocket dial failed: %s", err.Error())
	}
	// TODO: add proper error handling

	for {
		err = client.ReadJSON(updater.middlewareInfo)
		if err != nil {
			updater.log.Error("Websocket read failed:", err)
			err = client.Close()
			if err != nil {
				updater.log.Error("Failed to close websocket connection: ", err)
			}
			return
		}

		if err != nil {
			updater.log.Error("Websocket middlewareInfo Unmarshal failed:", err)
			err = client.Close()
			if err != nil {
				updater.log.Error("Failed to close websocket connection: ", err)
			}
			return
		}

		updater.Notify(observable.Event{
			Subject: fmt.Sprintf("/bitboxbases/%s/blockinfo", bitboxBaseID),
			Action:  action.Replace,
			Object:  updater.middlewareInfo,
		})
		updater.log.Printf("Received blockinfo: %v , from id: %s", updater.middlewareInfo, bitboxBaseID)
		if !updater.running {
			err = client.Close()
			if err != nil {
				updater.log.Error("Failed to close websocket connection: ", err)
			}
			return
		}
	}
}

/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { apiPort, apiToken, isTLS } from './request';
import { qtSubscribePushNotifications } from './qttransport';
import { androidSubscribePushNotifications } from './androidtransport';
import { TMsgCallback } from './transport-common';
import { runningInAndroid, runningInQtWebEngine } from './env';

let socket: WebSocket | undefined;

const currentListeners: TMsgCallback[] = [];

type UnsubscribeCallback = () => void;

export function apiWebsocket(msgCallback: TMsgCallback): UnsubscribeCallback {
  if (runningInQtWebEngine()) {
    return qtSubscribePushNotifications(msgCallback);
  }
  if (runningInAndroid()) {
    return androidSubscribePushNotifications(msgCallback);
  }
  currentListeners.push(msgCallback);
  if (!socket) {
    socket = new WebSocket((isTLS() ? 'wss://' : 'ws://') + 'localhost:' + apiPort + '/api/events');

    socket.onopen = function() {
      if (socket) {
        socket.send('Authorization: Basic ' + apiToken);
      }
    };

    socket.onerror = function(event) {
      console.error('websocket error', event);
    };

    // Listen for messages
    socket.onmessage = function(event) {
      const payload = JSON.parse(event.data);
      currentListeners.forEach(listener => listener(payload));
    };

    socket.onclose = function() {
      currentListeners.forEach(listener => listener({ subject: 'backend/connected', action: 'replace', object: false }));
    };
  }
  return () => {
    if (!currentListeners.includes(msgCallback)) {
      console.warn('!currentListeners.includes(msgCallback)');
    }
    const index = currentListeners.indexOf(msgCallback);
    currentListeners.splice(index, 1);
    if (currentListeners.includes(msgCallback)) {
      console.warn('currentListeners.includes(msgCallback)');
    }
  };
}

// SPDX-License-Identifier: Apache-2.0

import { apiPort, apiToken, isTLS } from './request';
import { TMsgCallback, TUnsubscribe } from './transport-common';

let socket: WebSocket | undefined;

const currentListeners: TMsgCallback[] = [];

export const webSubscribePushNotifications = (msgCallback: TMsgCallback): TUnsubscribe => {
  currentListeners.push(msgCallback);
  if (!socket) {
    socket = new WebSocket((isTLS() ? 'wss://' : 'ws://') + 'localhost:' + apiPort + '/api/events');

    socket.onopen = () => {
      if (socket) {
        socket.send('Authorization: Basic ' + apiToken);
      }
    };

    socket.onerror = (event) => {
      console.error('websocket error', event);
    };

    // Listen for messages
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      currentListeners.forEach(listener => listener(payload));
    };

    socket.onclose = () => {
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
};

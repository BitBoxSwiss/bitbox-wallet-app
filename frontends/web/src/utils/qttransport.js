/**
 * Copyright 2018 Shift Devices AG
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

import { QWebChannel } from './qwebchannel';
import { runningInQtWebEngine } from './env';

let cache = null;
let webChannel = null;
let queryID = 0;
let queryPromises = {};
let currentListeners = [];

function initTransport() {
  return new Promise((resolve, reject) => {
    if (webChannel) {
      resolve(webChannel);
    } else if (cache) {
      const check = function() { // eslint-disable-line func-style
        if (webChannel) {
          resolve(webChannel);
        } else {
          window.setTimeout(check, 1);
        }
      };
      check();
    } else if (runningInQtWebEngine()) {
      const initWebChannel = function(channel) { // eslint-disable-line func-style
        webChannel = channel;
        webChannel.objects.backend.gotResponse.connect((queryID, response) => {
          queryPromises[queryID].resolve(JSON.parse(response));
          delete queryPromises[queryID];
        });
        webChannel.objects.backend.pushNotify.connect(msg => {
          currentListeners.forEach(listener => listener(JSON.parse(msg)));
        });
        resolve(webChannel);
      };
      // @ts-ignore
      cache = new QWebChannel(qt.webChannelTransport, initWebChannel); // eslint-disable-line no-undef
    } else {
      reject();
    }
  });
}

export function call(query) {
  return new Promise((resolve, reject) => {
    initTransport().then(channel => {
      queryID++;
      queryPromises[queryID] = { resolve, reject };
      channel.objects.backend.call(queryID, query);
    });
  });
}

export function qtSubscribePushNotifications(msgCallback) {
  currentListeners.push(msgCallback);
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

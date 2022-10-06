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

import { TMsgCallback, TQueryPromiseMap } from './transport-common';
import { runningInAndroid } from './env';

let queryID: number = 0;
const queryPromises: TQueryPromiseMap = {};
const currentListeners: Function[] = [];

export function androidCall(query: string) {
  return new Promise((resolve, reject) => {
    if (runningInAndroid()) {
      if (typeof window.onAndroidCallResponse === 'undefined') {
        window.onAndroidCallResponse = (
          queryID: number,
          response: string,
        ) => {
          queryPromises[queryID].resolve(response);
          delete queryPromises[queryID];
        };
      }
      queryID++;
      queryPromises[queryID] = { resolve, reject };
      window.android!.call(queryID, query);
    } else {
      reject();
    }
  });
}

export function androidSubscribePushNotifications(msgCallback: TMsgCallback) {
  if (typeof window.onAndroidPushNotification === 'undefined') {
    window.onAndroidPushNotification = (msg: string) => {
      currentListeners.forEach(listener => listener(msg));
    };
  }

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

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

import { TMsgCallback, TPayload, TQueryPromiseMap } from './transport-common';
import { runningInAndroid, runningOnMobile } from './env';

let queryID: number = 0;
const queryPromises: TQueryPromiseMap = {};
const currentListeners: TMsgCallback[] = [];

export const mobileCall = (query: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    if (runningOnMobile()) {
      if (typeof window.onMobileCallResponse === 'undefined') {
        window.onMobileCallResponse = (queryID: number, response: unknown) => {
          queryPromises[queryID].resolve(response);
          delete queryPromises[queryID];
        };
      }
      queryID++;
      queryPromises[queryID] = { resolve, reject };
      if (runningInAndroid()) {
        window.android!.call(queryID, query);
      } else {
        // iOS
        window.webkit!.messageHandlers.goCall.postMessage({ queryID, query });
      }
    } else {
      reject();
    }
  });
};

export const mobileSubscribePushNotifications = (msgCallback: TMsgCallback) => {
  if (typeof window.onMobilePushNotification === 'undefined') {
    window.onMobilePushNotification = (msg: TPayload) => {
      currentListeners.forEach((listener) => listener(msg));
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
};

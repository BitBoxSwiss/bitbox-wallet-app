import { runningInAndroid } from './env';

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

let queryID = 0;
let queryPromises = {};
let currentListeners = [];

/* The following line declares this as a global variable to eslint */
/* global android */

export function androidCall(query) {
  return new Promise((resolve, reject) => {
    if (runningInAndroid()) {
      // @ts-ignore
      if (typeof window.onAndroidCallResponse === 'undefined') {
        // @ts-ignore
        window.onAndroidCallResponse = (queryID, response) => {
          queryPromises[queryID].resolve(response);
          delete queryPromises[queryID];
        };
      }

      queryID++;
      queryPromises[queryID] = { resolve, reject };
      // @ts-ignore
      android.call(queryID, query);
    } else {
      reject();
    }
  });
}

export function androidSubscribePushNotifications(msgCallback) {
  // @ts-ignore
  if (typeof window.onAndroidPushNotification === 'undefined') {
    // @ts-ignore
    window.onAndroidPushNotification = msg => {
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

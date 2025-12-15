// SPDX-License-Identifier: Apache-2.0

import { TMsgCallback, TPayload, TQueryPromiseMap } from './transport-common';
import { runningInAndroid, runningOnMobile } from './env';

let queryID: number = 0;
const queryPromises: TQueryPromiseMap = {};
const currentListeners: TMsgCallback[] = [];

export const mobileCall = (query: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    if (runningOnMobile()) {
      if (typeof window.onMobileCallResponse === 'undefined') {
        window.onMobileCallResponse = (
          queryID: number,
          response: unknown,
        ) => {
          queryPromises[queryID]?.resolve(response);
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
};

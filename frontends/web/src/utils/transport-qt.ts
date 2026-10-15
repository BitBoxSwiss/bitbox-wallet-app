// SPDX-License-Identifier: Apache-2.0

import { QWebChannel } from './qwebchannel';
import { TMsgCallback, TQueryPromiseMap } from './transport-common';
import { runningInQtWebEngine } from './env';

let webChannel: Promise<any> | undefined;
let queryID: number = 0;
const queryPromises: TQueryPromiseMap = {};
const currentListeners: TMsgCallback[] = [];

export const getQtChannel = (): Promise<any> => {
  if (!runningInQtWebEngine()) {
    return Promise.reject(new Error('Must be running in Qt'));
  }
  if (webChannel) {
    return webChannel;
  }
  webChannel = new Promise(resolve => {
    const initWebChannel = (channel: any) => {
      channel.objects.backend.gotResponse.connect((
        queryID: number,
        response: string,
      ) => {
        queryPromises[queryID]?.resolve(JSON.parse(response));
        delete queryPromises[queryID];
      });
      channel.objects.backend.pushNotify.connect((msg: string) => {
        currentListeners.forEach(listener => listener(JSON.parse(msg)));
      });
      resolve(channel);
    };
    new QWebChannel((window.qt!).webChannelTransport, initWebChannel);
  });
  return webChannel;
};

export const call = (query: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    getQtChannel().then((channel: any) => {
      queryID++;
      queryPromises[queryID] = { resolve, reject };
      channel.objects.backend.call(queryID, query);
    });
  });
};

export const qtSubscribePushNotifications = (msgCallback: TMsgCallback) => {
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

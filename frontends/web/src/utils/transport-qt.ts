// SPDX-License-Identifier: Apache-2.0

import { QWebChannel } from './qwebchannel';
import { TMsgCallback, TQueryPromiseMap } from './transport-common';
import { runningInQtWebEngine } from './env';

let webChannel: any = null;
let queryID: number = 0;
const queryPromises: TQueryPromiseMap = {};
const currentListeners: TMsgCallback[] = [];

const initTransport = async () => {
  if (!runningInQtWebEngine()) {
    throw new Error('Must be running in Qt');
  }
  if (webChannel) {
    return webChannel;
  }
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
    webChannel = channel;
  };
  new QWebChannel((window.qt!).webChannelTransport, initWebChannel);
  while (!webChannel) {
    await new Promise(r => setTimeout(r, 1));
  }
  return webChannel;
};

export const call = (query: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    initTransport().then((channel: any) => {
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

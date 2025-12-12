// SPDX-License-Identifier: Apache-2.0

import { apiSubscribe, TEvent, TUnsubscribe } from '@/utils/event';
import { apiGet } from '@/utils/request';

export type { TUnsubscribe };

export type TSubscriptionCallback<T> = (eventObject: T) => void;

/**
 * Subscribes the given function on an endpoint on which the backend
 * can push data through. This should be mostly used within api.
 */
export const subscribeEndpoint = <T>(
  endpoint: string,
  cb: TSubscriptionCallback<T>,
): TUnsubscribe => {
  return apiSubscribe(endpoint, (event: TEvent) => {
    switch (event.action) {
    case 'replace':
      cb(event.object);
      break;
    case 'reload':
      // TODO: backend should push data with "replace" and not use "reload"
      apiGet(event.subject)
        .then(object => cb(object))
        .catch(console.error);
      break;
    default:
      throw new Error(`Event: ${JSON.stringify(event)} not supported`);
    }
  });
};

/**
 * Subscribes the given function to the backend/connected event.
 * This is not an event sent by the backend, but is called when
 * the connection to the backend is lost.
 * See utils/websocket.js
 */
export const backendConnected = (
  cb: (connected: boolean) => void
): TUnsubscribe => {
  return subscribeEndpoint('backend/connected', cb);
};

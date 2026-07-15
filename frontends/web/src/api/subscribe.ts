// SPDX-License-Identifier: Apache-2.0

import { apiSubscribe, TEvent, TUnsubscribe } from '@/utils/event';
import { apiPost } from '@/utils/request';

export type { TUnsubscribe };

export type TSubscriptionCallback<T> = (eventObject: T) => void;

const observeEndpoint = <T>(
  endpoint: string,
  cb: TSubscriptionCallback<T>,
): TUnsubscribe => {
  return apiSubscribe(endpoint, (event: TEvent) => {
    switch (event.action) {
    case 'replace':
      cb(event.object);
      break;
    default:
      throw new Error(`Event: ${JSON.stringify(event)} not supported`);
    }
  });
};

/**
 * Subscribes to a backend value and requests its current snapshot through the
 * same ordered event stream as live replacements.
 */
export const subscribeEndpoint = <T>(
  endpoint: string,
  cb: TSubscriptionCallback<T>,
): TUnsubscribe => {
  const unsubscribe = observeEndpoint(endpoint, cb);
  apiPost('events/snapshot', endpoint).catch(console.error);
  return unsubscribe;
};

/**
 * Subscribes to transient backend events that do not have an initial snapshot.
 */
export const subscribeEvent = <T>(
  endpoint: string,
  cb: TSubscriptionCallback<T>,
): TUnsubscribe => observeEndpoint(endpoint, cb);

/**
 * Subscribes the given function to the backend/connected event.
 * This is not an event sent by the backend, but is called when
 * the connection to the backend is lost.
 * See utils/websocket.js
 */
export const backendConnected = (
  cb: (connected: boolean) => void
): TUnsubscribe => {
  return subscribeEvent('backend/connected', cb);
};

/**
 * Copyright 2022-2024 Shift Crypto AG
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

import { apiSubscribe, TEvent, TUnsubscribe } from '@/utils/event';
import { apiGet } from '@/utils/request';

export type { TUnsubscribe };

export type TSubscriptionCallback<T> = (eventObject: T) => void;

/**
 * Subscribes the given function on an endpoint on which the backend
 * can push data through. This should be mostly used within api.
 * Note there is a subscibe-legacy.ts module that supports older events.
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
      throw new Error(`Event: ${event} not supported`);
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

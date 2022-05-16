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

import { apiWebsocket } from './websocket';

/**
 * This type describes the subject of an event.
 */
export type Subject = string;

/**
 * This type enumerates the various actions of an event.
 */
export type Action = 'replace' | 'reload';

/**
 * This interface models the events that are received from the backend.
 */
export interface Event {
    readonly subject: Subject;
    readonly action: Action;
    readonly object: any;
}

/**
 * This type describes the function used to observe the events.
 */
export type Observer = (event: Event) => void;

/**
 * This type describes the method returned to unsubscribe again.
 */
export type Unsubscribe = () => void;

/**
 * This interface describes how the subscriptions are stored.
 */
interface Subscriptions {
    [subject: string]: Observer[]; // TypeScript does not allow the type alias Subject there.
}

/**
 * Stores the subscriptions as an object-based hash map.
 */
const subscriptions: Subscriptions = {};

/**
 * This function dispatches the events from the websocket to the observers.
 */
function handleEvent(payload: any): void {
  if (typeof payload.subject === 'string') {
    if (subscriptions[payload.subject]) {
      for (const observer of subscriptions[payload.subject]) {
        observer(payload as Event);
      }
    }
  }
}

/**
 * This variable keeps track of whether the below method has subscribed to the websocket.
 */
let subscribed: Unsubscribe | null = null;

/**
 * Subscribes the given observer on events of the given subject and returns a method to unsubscribe.
 */
export function apiSubscribe(subject: Subject, observer: Observer): Unsubscribe {
  if (!subscribed) {
    subscribed = apiWebsocket(handleEvent);
  }
  let observers = subscriptions[subject];
  if (observers === undefined) {
    observers = [];
    subscriptions[subject] = observers;
  }
  observers.push(observer);
  return () => {
    if (!observers.includes(observer)) {
      console.warn('!observers.includes(observer)');
    }
    const index = observers.indexOf(observer);
    observers.splice(index, 1);
    if (observers.includes(observer)) {
      console.warn('observers.includes(observer)');
    }
  };
}

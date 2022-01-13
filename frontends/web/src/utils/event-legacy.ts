/**
 * Copyright 2021 Shift Crypto AG
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

import { apiWebsocket } from '../utils/websocket';

/**
 * This type describes the subject of an event.
 */

type Subject = string;

/**
 * This interface models the legacy events that are received from the backend.
 */

export interface IEvent {
    readonly data?: Subject;
    readonly deviceID?: string;
    readonly meta?: null;
    readonly type?: string;
    readonly code?: string;
}

/**
 * This type describes the function used to observe the events.
 */

 type Observer = (event: IEvent) => void;

/**
 * This type describes the method returned to unsubscribe again.
 */

export type IUnsubscribe = () => void;

/**
 * This interface describes how the subscriptions are stored.
 */

interface ISubscriptions {
    [subject: string]: Observer[];
}

/**
 * Stores the subscriptions as an object-based hash map.
 */

const subscriptions: ISubscriptions = {};

/**
 * This function dispatches the events from the websocket to the observers.
 */

function handleMessages(payload: IEvent): void {
  if (
    payload.data
        && typeof payload.data === 'string'
        && payload.data in subscriptions
        && subscriptions[payload.data].length
  ) {
    for (const observer of subscriptions[payload.data]) {
      observer(payload);
    }
  }
}

/**
 * Subscribes the given observer on events of the given subject and returns a method to unsubscribe.
 */

export function subscribe(subject: Subject, observer: Observer): IUnsubscribe {
  if (!subscriptions[subject]) {
    subscriptions[subject] = [];
  }
  const observers = subscriptions[subject];
  if (observers.includes(observer)) {
    console.error(`observer already registered for ${subject}`);
  }
  observers.push(observer);
  return () => {
    if (!observers.includes(observer)) {
      console.error('!observers.includes(observer)');
    }
    const index = observers.indexOf(observer);
    observers.splice(index, 1);
  };
}

apiWebsocket(handleMessages);

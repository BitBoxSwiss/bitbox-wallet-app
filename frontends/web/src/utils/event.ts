// SPDX-License-Identifier: Apache-2.0

import { apiWebsocket, TUnsubscribe } from './websocket';
import { TEvent, TPayload, TSubject } from './transport-common';

export type { TEvent, TUnsubscribe };

/**
 * This type describes the function used to observe the events.
 */
export type Observer = (event: TEvent) => void;

/**
 * This type describes how the subscriptions are stored.
 */
type Subscriptions = {
  [subject: string]: Observer[]; // TypeScript does not allow the type alias Subject there.
};

/**
 * Stores the subscriptions as an object-based hash map.
 */
const subscriptions: Subscriptions = {};

/**
 * This function dispatches the events from the websocket to the observers.
 */
const handleEvent = (payload: TPayload): void => {
  if (
    'subject' in payload
    && typeof payload.subject === 'string'
  ) {
    const subscription = subscriptions[payload.subject];
    if (subscription) {
      for (const observer of subscription) {
        observer(payload);
      }
    }
  }
};

/**
 * This variable keeps track of whether the below method has subscribed to the websocket.
 */
let subscribed: TUnsubscribe | null = null;

/**
 * Subscribes the given observer on events of the given subject and returns a method to unsubscribe.
 */
export const apiSubscribe = (
  subject: TSubject,
  observer: Observer
): TUnsubscribe => {
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
};

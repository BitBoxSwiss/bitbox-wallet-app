// SPDX-License-Identifier: Apache-2.0

/**
 * This type describes the subject of an event.
 */
export type TSubject = string;

/**
 * This type enumerates the various actions of an event.
 */
type TAction = 'replace' | 'reload';

/**
 * This type models the events that are received from the backend.
 */
export type TEvent = {
  readonly action: TAction;
  readonly object: any;
  readonly subject: TSubject;
};

/**
 * This type models the legacy events that are received from the backend.
 */
export type TEventLegacy = {
  readonly code?: string;
  readonly data?: TSubject;
  readonly deviceID?: string;
  readonly meta?: any;
  readonly type: string;
};

export type TPayload = TEventLegacy | TEvent;

export type TMsgCallback = (payload: TPayload) => void;

export type TQueryPromiseMap = {
  [key: number]: {
    resolve: (value: unknown) => void;
    reject: (value: unknown) => void;
  };
};

export type TUnsubscribe = () => void;

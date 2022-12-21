/**
 * Copyright 2022 Shift Crypto AG
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
}

export type TPayload = TEventLegacy | TEvent;

export type TMsgCallback = (payload: TPayload) => void;

export type TQueryPromiseMap = {
  [key: number]: {
    resolve: (value: unknown) => void,
    reject: (value: unknown) => void,
  };
};

export type TUnsubscribe = () => void;

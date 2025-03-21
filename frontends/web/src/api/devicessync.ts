/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { subscribeEndpoint, TSubscriptionCallback, TUnsubscribe } from './subscribe';
import { subscribe as subscribeLegacy } from '@/utils/event-legacy';
import { TDevices } from './devices';
import { TStatus } from './bitbox02';

/**
 * Subscribes the given function on the "devices/registered" event
 * and receives a list of all available accounts from the backend.
 * Returns a method to unsubscribe.
 */
export const syncDeviceList = (
  cb: (accounts: TDevices,) => void
): TUnsubscribe => {
  return subscribeEndpoint('devices/registered', cb);
};

/**
 * Fires when status of a device changed.
 * Returns a method to unsubscribe.
 */
export const statusChanged = (
  deviceID: string,
  cb: TSubscriptionCallback<TStatus>,
): TUnsubscribe => {
  return subscribeEndpoint(`devices/bitbox02/${deviceID}/status`, cb);
};

/**
 * Fires when attestation hash of a device changed.
 * Returns a method to unsubscribe.
 */
export const channelHashChanged = (
  deviceID: string,
  cb: () => void,
): TUnsubscribe => {
  return subscribeEndpoint(`devices/bitbox02/${deviceID}/channelHashChanged`, cb);
};

/**
 * Fires when attestation check of a device is done.
 * Returns a method to unsubscribe.
 */
export const attestationCheckDone = (
  deviceID: string,
  cb: () => void,
): TUnsubscribe => {
  return subscribeEndpoint(`devices/bitbox02/${deviceID}/attestationCheckDone`, cb);
};

export type TSignProgress = {
  steps: number;
  step: number;
}

export const syncSignProgress = (
  cb: (progress: TSignProgress) => void
): TUnsubscribe => {
  const unsubscribe = subscribeLegacy('signProgress', event => {
    if ('type' in event && event.type === 'device' && event.data === 'signProgress') {
      cb(event.meta);
    }
  });
  return unsubscribe;
};

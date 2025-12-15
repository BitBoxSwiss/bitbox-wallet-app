// SPDX-License-Identifier: Apache-2.0

import type { TDevices } from './devices';
import { subscribeEndpoint, TSubscriptionCallback, TUnsubscribe } from './subscribe';

/**
 * Subscribes the given function on the "devices/registered" event
 * and receives a list of all available accounts from the backend.
 * Returns a method to unsubscribe.
 */
export const syncDeviceList = (
  cb: TSubscriptionCallback<TDevices>,
): TUnsubscribe => {
  return subscribeEndpoint('devices/registered', cb);
};

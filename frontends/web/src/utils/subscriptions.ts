// SPDX-License-Identifier: Apache-2.0

import { TUnsubscribe } from './transport-common';

export type UnsubscribeList = Array<(TUnsubscribe)>;

/**
 * Helper function that takes an array of unsubscribe callbacks.
 * It calls and removes all unsubscribers from the array.
 * This is only useful if you component has more than 1 subscribtion.
 */
export const unsubscribe = (unsubscribeList: UnsubscribeList) => {
  for (const unsubscribeCallback of unsubscribeList) {
    unsubscribeCallback();
  }
  unsubscribeList.splice(0, unsubscribeList.length);
};

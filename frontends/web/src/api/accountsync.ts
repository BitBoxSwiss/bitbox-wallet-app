// SPDX-License-Identifier: Apache-2.0

import type { TUnsubscribe } from '@/utils/transport-common';
import type { AccountCode, TAccount, TStatus, TTransactions } from './account';
import { TSubscriptionCallback, subscribeEndpoint, subscribeEvent } from './subscribe';

/**
 * Subscribes the given function on the "account" event and receives the
 * list of all available accounts from the backend.
 * Returns a method to unsubscribe.
 */
export const syncAccountsList = (
  cb: (accounts: TAccount[]) => void
): TUnsubscribe => {
  return subscribeEndpoint('accounts', cb);
};

/**
 * Returns a function that subscribes a callback on a "account/<CODE>/synced-addresses-count"
 * event to receive the progress of the address sync.
 * Meant to be used with `useSubscribe`.
 */
export const syncAddressesCount = (code: AccountCode) => {
  return (
    cb: TSubscriptionCallback<number>
  ) => {
    return subscribeEvent(`account/${code}/synced-addresses-count`, cb);
  };
};

/**
 * Sends the current account status and fires whenever it changes.
 * Returns a method to unsubscribe.
 */
export const statusChanged = (
  code: AccountCode,
  cb: TSubscriptionCallback<TStatus>,
): TUnsubscribe => {
  return subscribeEndpoint(`account/${code}/status`, cb);
};

/**
 * Fired when the account is fully synced.
 * Returns a method to unsubscribe.
 */
export const syncdone = (
  code: AccountCode,
  cb: () => void,
): TUnsubscribe => {
  return subscribeEvent(`account/${code}/sync-done`, cb);
};

/**
 * Fired when the account transaction list changed.
 * Returns a method to unsubscribe.
 */
export const transactionsChanged = (
  code: AccountCode,
  cb: TSubscriptionCallback<TTransactions>,
): TUnsubscribe => {
  return subscribeEndpoint(`account/${code}/transactions`, cb);
};

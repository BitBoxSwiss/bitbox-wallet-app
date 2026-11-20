// SPDX-License-Identifier: Apache-2.0

import type { TUnsubscribe } from '@/utils/transport-common';
import type { TAccountCode, TAccount, TStatus, TTransactions } from './account';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';

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
export const syncAddressesCount = (code: TAccountCode) => {
  return (
    cb: TSubscriptionCallback<number>
  ) => {
    return subscribeEndpoint(`account/${code}/synced-addresses-count`, cb);
  };
};

/**
 * Fired when status of an account changed, mostly
 * used as event to call accountAPI.getStatus(code).
 * Returns a method to unsubscribe.
 */
export const statusChanged = (
  code: TAccountCode,
  cb: TSubscriptionCallback<TStatus>,
): TUnsubscribe => {
  return subscribeEndpoint(`account/${code}/status`, cb);
};

/**
 * Fired when the account is fully synced.
 * Returns a method to unsubscribe.
 */
export const syncdone = (
  code: TAccountCode,
  cb: () => void,
): TUnsubscribe => {
  return subscribeEndpoint(`account/${code}/sync-done`, cb);
};

/**
 * Fired when the account transaction list changed.
 * Returns a method to unsubscribe.
 */
export const transactionsChanged = (
  code: TAccountCode,
  cb: TSubscriptionCallback<TTransactions>,
): TUnsubscribe => {
  return subscribeEndpoint(`account/${code}/transactions`, cb);
};

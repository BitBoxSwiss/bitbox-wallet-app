/**
 * Copyright 2023 Shift Crypto AG
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

import { TUnsubscribe } from '@/utils/transport-common';
import * as accountAPI from './account';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';

/**
 * Subscribes the given function on the "account" event and receives the
 * list of all available accounts from the backend.
 * Returns a method to unsubscribe.
 */
export const syncAccountsList = (
  cb: (accounts: accountAPI.IAccount[],) => void
): TUnsubscribe => {
  return subscribeEndpoint('accounts', cb);
};

/**
 * Returns a function that subscribes a callback on a "account/<CODE>/synced-addresses-count"
 * event to receive the progress of the address sync.
 * Meant to be used with `useSubscribe`.
 */
export const syncAddressesCount = (code: accountAPI.AccountCode) => {
  return (
    cb: TSubscriptionCallback<number>
  ) => {
    return subscribeEndpoint(`account/${code}/synced-addresses-count`, (
      count: number,
    ) => {
      cb(count);
    });
  };
};

/**
 * Fired when status of an account changed, mostly
 * used as event to call accountAPI.getStatus(code).
 * Returns a method to unsubscribe.
 */
export const statusChanged = (
  code: accountAPI.AccountCode,
  cb: () => void,
): TUnsubscribe => {
  return subscribeEndpoint(`account/${code}/status-changed`, cb);
};

/**
 * Fired when the account is fully synced.
 * Returns a method to unsubscribe.
 */
export const syncdone = (
  code: accountAPI.AccountCode,
  cb: () => void,
): TUnsubscribe => {
  return subscribeEndpoint(`account/${code}/sync-done`, cb);
};

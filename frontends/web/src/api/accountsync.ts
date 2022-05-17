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

import { subscribeEndpoint } from './subscribe';
import { Unsubscribe } from '../utils/event';
import { IAccount } from './account';

/**
 * Subscribes the given function on the "account" event and receives the
 * list of all available accounts from the backend.
 * Returns a method to unsubscribe.
 */

export const syncAccountsList = (
  cb: (accounts: IAccount[],) => void
): Unsubscribe => {
  return subscribeEndpoint('accounts', cb);
};

/**
 * Subscribes the given function on an "account/<CODE>/synced-addresses-count" event
 * to receive the progress of the address sync.
 * Returns a method to unsubscribe.
 */

export const syncAddressesCount = (
  code: string,
  cb: (code: string, syncedAddressesCount: number) => void,
): Unsubscribe => {
  return subscribeEndpoint(`account/${code}/synced-addresses-count`, (
    data: number,
  ) => {
    cb(code, data);
  });
};

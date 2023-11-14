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

import { apiGet } from '../utils/request';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';

export type Keystore = {
  type: string;
};

export const getKeystores = async (): Promise<Keystore[]> => {
  return await apiGet('keystores');
};

/**
 * Subscriptions
 */

/**
 * Returns a function that subscribes a callback on a "keystores"
 * event to notify when a change to the keystores list has occurred.
 * Meant to be used with `useSubscribe`.
 */
export const subscribeKeystores = (cb: TSubscriptionCallback<Keystore[]>) => {
  return subscribeEndpoint('keystores', cb);
};

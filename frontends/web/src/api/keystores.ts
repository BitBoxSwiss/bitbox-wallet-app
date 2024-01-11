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

import { subscribeEndpoint, TSubscriptionCallback, TUnsubscribe } from './subscribe';
import { apiGet, apiPost } from '../utils/request';

export type { TUnsubscribe };

type TKeystore = { type: 'hardware' | 'software' };
export type TKeystores = TKeystore[];

export const subscribeKeystores = (
  cb: (keystores: TKeystores) => void
) => {
  return subscribeEndpoint('keystores', cb);
};

export const getKeystores = (): Promise<TKeystores> => {
  return apiGet('keystores');
};

export type TSyncConnectKeystore = null | {
  typ: 'connect';
  keystoreName: string;
} | {
  typ: 'error';
  errorCode: 'wrongKeystore';
  errorMessage: '';
};

/**
 * Returns a function that subscribes a callback on a "connect-keystore".
 * Meant to be used with `useSubscribe`.
 */
export const syncConnectKeystore = () => {
  return (
    cb: TSubscriptionCallback<TSyncConnectKeystore>
  ) => {
    return subscribeEndpoint('connect-keystore', (
      obj: TSyncConnectKeystore,
    ) => {
      cb(obj);
    });
  };
};

export const cancelConnectKeystore = (): Promise<void> => {
  return apiPost('cancel-connect-keystore');
};



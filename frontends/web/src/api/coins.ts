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

import { subscribeEndpoint, TSubscriptionCallback } from './subscribe';
import { CoinCode } from './account';
import { ISuccess } from './backend';
import { apiPost } from '../utils/request';

export type BtcUnit = 'default' | 'sat';

export type TStatus = {
    targetHeight: number;
    tip: number;
    tipAtInitTime: number;
    tipHashHex: string;
}

export const subscribeCoinHeaders = (coinCode: CoinCode) => (
  (cb: TSubscriptionCallback<TStatus>) => (
    subscribeEndpoint(`coins/${coinCode}/headers/status`, cb)
  )
);

export const setBtcUnit = (unit: BtcUnit): Promise<ISuccess> => {
  return apiPost('coins/btc/set-unit', { unit });
};

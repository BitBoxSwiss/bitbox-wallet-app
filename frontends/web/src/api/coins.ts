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
import type { CoinCode, Fiat, IAmount } from './account';
import type { ISuccess } from './backend';
import { apiPost, apiGet } from '../utils/request';

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

export type TAmount = {
  success: boolean;
  amount: string;
}

export const parseExternalBtcAmount = (amount: string): Promise<TAmount> => {
  return apiGet(`coins/btc/parse-external-amount?amount=${amount}`);
};

export const getBtcSatsAmount = (sats: string): Promise<{ success: false } | { success: true, amount: IAmount }> => {
  return apiGet(`coins/btc/sats-amount?sats=${sats}`);
};

type TConvertCurrency = {
  amount: string;
  coinCode: CoinCode;
  fiatUnit: Fiat;
};

type TConvertFromCurrencyResponse = {
  success: true;
  amount: string;
} | {
  success: false;
  errMsg: string; // TODO: backend should return useful errorMessage
};

export const convertFromCurrency = ({
  amount,
  coinCode,
  fiatUnit,
}: TConvertCurrency): Promise<TConvertFromCurrencyResponse> => {
  return apiGet(`coins/convert-from-fiat?from=${fiatUnit}&to=${coinCode}&amount=${amount}`);
};

type TConvertToCurrencyResponse = {
  success: true;
  fiatAmount: string;
} | {
  success: false;
  // errMsg: string; // TODO: backend should return useful errorMessage
};

export const convertToCurrency = ({
  amount,
  coinCode,
  fiatUnit,
}: TConvertCurrency): Promise<TConvertToCurrencyResponse> => {
  return apiGet(`coins/convert-to-plain-fiat?from=${coinCode}&to=${fiatUnit}&amount=${amount}`);
};

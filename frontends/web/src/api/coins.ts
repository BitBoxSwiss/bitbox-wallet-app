// SPDX-License-Identifier: Apache-2.0

import type { CoinCode, Fiat } from './account';
import { subscribeEndpoint, TSubscriptionCallback } from './subscribe';
import { apiPost, apiGet } from '@/utils/request';

export type BtcUnit = 'default' | 'sat';

export type TStatus = {
  targetHeight: number;
  tip: number;
  tipAtInitTime: number;
  tipHashHex: string;
};

export const subscribeCoinHeaders = (coinCode: CoinCode) => (
  (cb: TSubscriptionCallback<TStatus>) => (
    subscribeEndpoint(`coins/${coinCode}/headers/status`, cb)
  )
);

export type TSetBtcUnitResponse = {
  success: boolean;
};

export const setBtcUnit = (unit: BtcUnit): Promise<TSetBtcUnitResponse> => {
  return apiPost('coins/btc/set-unit', { unit });
};

export type TAmount = {
  success: boolean;
  amount: string;
};

export const parseExternalBtcAmount = (amount: string): Promise<TAmount> => {
  return apiGet(`coins/btc/parse-external-amount?amount=${amount}`);
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

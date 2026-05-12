// SPDX-License-Identifier: Apache-2.0

import type { CoinCode, Fiat, TAmountWithConversions } from './account';
import type { NativeCoinUnit } from './account';
import type { TUnsubscribe } from '@/utils/transport-common';
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

type TSetBtcUnitResponse = {
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

type TSatsAmountResponse = {
  success: true;
  amount: TAmountWithConversions;
} | {
  success: false;
};

export const getBtcSatsAmount = (sats: string): Promise<TSatsAmountResponse> => {
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

type TCoinFiatPrices = {
  amount: string;
  unit: NativeCoinUnit;
  conversions: Record<Fiat, string>;
  estimated: boolean;
} | null;

export const getCoinFiatPrices = (coinCode: CoinCode): Promise<TCoinFiatPrices> => {
  return apiGet(`coins/${coinCode}/fiat-prices`);
};

export const subscribeCoinFiatPrices = (coinCode: CoinCode) => (
  (cb: TSubscriptionCallback<TCoinFiatPrices>): TUnsubscribe => (
    subscribeEndpoint(`coins/${coinCode}/fiat-prices`, cb)
  )
);

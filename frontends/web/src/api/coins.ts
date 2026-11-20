// SPDX-License-Identifier: Apache-2.0

import type { TCoinCode, TFiat, TAmountWithConversions } from './account';
import type { TNativeCoinUnit } from './account';
import type { TUnsubscribe } from '@/utils/transport-common';
import { subscribeEndpoint, TSubscriptionCallback } from './subscribe';
import { apiPost, apiGet } from '@/utils/request';

export type BtcUnit = 'default' | 'sat';

export type THeadersStatus = {
  targetHeight: number;
  tip: number;
  tipAtInitTime: number;
  tipHashHex: string;
};

export type TStatus = {
  success: true;
  status: THeadersStatus;
} | {
  success: false;
  errorMessage: string;
};

export const subscribeCoinHeaders = (coinCode: TCoinCode) => (
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

export type TBtcSatAmount = TAmountWithConversions & {
  unit: 'sat';
};

type TBtcSatAmountRequest = {
  source: 'sat' | 'fiat';
  amount: string;
};

type TBtcSatAmountResponse = {
  success: true;
  amount: TBtcSatAmount;
} | {
  success: false;
  errorMessage?: string;
};

export const getBtcSatAmount = ({
  source,
  amount,
}: TBtcSatAmountRequest): Promise<TBtcSatAmountResponse> => {
  const searchParams = new URLSearchParams({
    source,
    amount,
  });
  return apiGet(`coins/btc/sat-amount?${searchParams}`);
};

type TConvertCurrency = {
  amount: string;
  coinCode: TCoinCode;
  fiatUnit: TFiat;
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
  unit: TNativeCoinUnit;
  conversions: Record<TFiat, string>;
  estimated: boolean;
} | null;

export const getCoinFiatPrices = (coinCode: TCoinCode): Promise<TCoinFiatPrices> => {
  return apiGet(`coins/${coinCode}/fiat-prices`);
};

export const subscribeCoinFiatPrices = (coinCode: TCoinCode) => (
  (cb: TSubscriptionCallback<TCoinFiatPrices>): TUnsubscribe => (
    subscribeEndpoint(`coins/${coinCode}/fiat-prices`, cb)
  )
);

export type TCoin = {
  coinCode: TCoinCode;
  name: string;
  canAddAccount: boolean;
  suggestedAccountName: string;
};

export const getSupportedCoins = (): Promise<TCoin[]> => {
  return apiGet('supported-coins');
};

// SPDX-License-Identifier: Apache-2.0

import type { ERC20CoinCode } from './erc20';
import type { AccountCode, CoinCode, NativeCoinCode, TAccountBase, TTxInput } from './account';
import { apiGet, apiPost } from '@/utils/request';

export type TSwapAccount = TAccountBase & ({
  isToken: true;
  coinCode: ERC20CoinCode;
  parentAccountCode: AccountCode;
} | {
  isToken: false;
  coinCode: NativeCoinCode;
  parentAccountCode?: never;
});

export type TSwapAccounts = {
  success: true;
  sellAccounts: TSwapAccount[];
  buyAccounts: TSwapAccount[];
} | {
  success: false;
  errorMessage: string;
};

export const getSwapAccounts = (): Promise<TSwapAccounts> => {
  return apiGet('swap/accounts');
};

export type TSwapQuoteRequest = {
  buyCoinCode: CoinCode;
  sellAccountCode?: AccountCode;
  sellAmount: string;
  sellCoinCode: CoinCode;
};

export type TSwapQuoteRoute = {
  routeId: string;
  expectedBuyAmount: string;
};

export type TSwapQuoteResponse = {
  success: true;
  quote: {
    routes: TSwapQuoteRoute[];
  };
} | {
  success: false;
  errorCode: string;
  errorMessage: string;
};
export const getSwapQuote = (
  data: TSwapQuoteRequest,
): Promise<TSwapQuoteResponse> => {
  return apiPost('swap/quote', data);
};

export type TSwapSignRequest = {
  buyAccountCode: AccountCode;
  routeId: string;
  sellAccountCode: AccountCode;
  sellAmount: string;
};

export type TSwapSignResponse = {
  success: true;
  expectedBuyAmount: string;
  swapId: string;
  txInput: TTxInput;
} | {
  success: false;
  errorMessage: string;
};

export const signSwap = (
  data: TSwapSignRequest,
): Promise<TSwapSignResponse> => {
  return apiPost('swap/sign', data);
};

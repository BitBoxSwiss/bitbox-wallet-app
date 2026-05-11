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
  defaultSellAccountCode?: AccountCode;
  defaultBuyAccountCode?: AccountCode;
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
  expectedBuyAmount: string;
  providers: string[];
  routeId: string;
};

export type TSwapQuoteErrorCode =
  | 'insufficientFunds'
  | 'invalidRequest'
  | 'noRoutesFound'
  | 'unexpectedError';

export type TSwapQuoteValidationErrorCode = Extract<TSwapQuoteErrorCode, 'insufficientFunds'>;

export type TSwapQuoteResponse = {
  success: true;
  quote: {
    routes: TSwapQuoteRoute[];
  };
} | {
  success: false;
  errorCode: TSwapQuoteErrorCode;
  errorData?: {
    buyCoin?: string;
    sellCoin?: string;
  };
  errorMessage: string;
  validationErrorCode?: TSwapQuoteValidationErrorCode;
  quote?: {
    routes: TSwapQuoteRoute[];
  };
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

export type TSwapStatusResponse = {
  available: boolean;
  connectedKeystore: 'none' | 'multi' | 'btc-only';
};

export const getSwapStatus = (): Promise<TSwapStatusResponse> => {
  return apiGet('swap/status');
};

export const signSwap = (
  data: TSwapSignRequest,
): Promise<TSwapSignResponse> => {
  return apiPost('swap/sign', data);
};

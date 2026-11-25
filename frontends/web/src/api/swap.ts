// SPDX-License-Identifier: Apache-2.0

import type { TERC20CoinCode } from './erc20';
import type { TAccountCode, TCoinCode, TCoinUnit, TNativeCoinCode, TAccountBase, TTxInput } from './account';
import { apiGet, apiPost } from '@/utils/request';

export type TSwapAccount = TAccountBase & ({
  isToken: true;
  coinCode: TERC20CoinCode;
  parentAccountCode: TAccountCode;
} | {
  isToken: false;
  coinCode: TNativeCoinCode;
  parentAccountCode?: never;
});

export type TSwapAccounts = {
  success: true;
  sellAccounts: TSwapAccount[];
  buyAccounts: TSwapAccount[];
  defaultSellAccountCode?: TAccountCode;
  defaultBuyAccountCode?: TAccountCode;
} | {
  success: false;
  errorMessage: string;
};

export const getSwapAccounts = (): Promise<TSwapAccounts> => {
  return apiGet('swap/accounts');
};

export type TSwapQuoteRequest = {
  buyCoinCode: TCoinCode;
  sellAccountCode: TAccountCode;
  sellAmount: string;
};

export type TSwapQuoteRoute = {
  expectedBuyAmount: string;
  insufficientGasFunds?: boolean;
  providers: string[];
  routeId: string;
};

// SwapKit can introduce other codes. Keep the known literals available for autocomplete.
export type TSwapProviderErrorCode =
  | 'sellAssetAmountTooSmall'
  | 'insufficientLiquidity'
  | 'estimatedTimeTooLong'
  | 'swapHalted'
  | 'invalidAsset'
  | 'invalidChain'
  | 'unsupportedChainId'
  | 'unsupportedMethod'
  | (string & {});

export type TSwapProviderError = {
  provider: string;
  errorCode: TSwapProviderErrorCode;
  message: string;
  minAmount?: { amount: string; unit: TCoinUnit };
};

export type TSwapQuote = {
  routes: TSwapQuoteRoute[];
  providerErrors?: TSwapProviderError[];
};

export type TSwapQuoteErrorCode =
  | 'invalidRequest'
  | 'noRoutesFound'
  | 'providersUnavailable'
  | 'unexpectedError';

export type TSwapQuoteValidationErrorCode = 'insufficientFunds';

export type TSwapQuoteResponse = {
  // Balance validation can accompany a successful quote with usable routes.
  validationErrorCode?: TSwapQuoteValidationErrorCode;
} & ({
  success: true;
  quote: TSwapQuote;
} | {
  success: false;
  // Failures before a quote is received have no provider details.
  quote?: TSwapQuote;
  quoteErrorCode: TSwapQuoteErrorCode;
  errorData?: {
    buyCoin?: string;
    sellCoin?: string;
  };
  errorMessage: string;
});
export const getSwapQuote = (
  data: TSwapQuoteRequest,
): Promise<TSwapQuoteResponse> => {
  return apiPost('swap/quote', data);
};

export type TSwapSignRequest = {
  buyAccountCode: TAccountCode;
  routeId: string;
  sellAccountCode: TAccountCode;
  sellAmount: string;
};

export type TSwapSignResponse = {
  success: true;
  expectedBuyAmount: string;
  swapId: string;
  txInput: TTxInput;
} | {
  success: false;
  errorCode?: 'syncInProgress';
  errorMessage: string;
};

export type TSwapStatusResponse = {
  available: boolean;
  connectedKeystore: 'none' | 'multi' | 'btc-only';
  firmwareUpgradeRequired: boolean;
};

export const getSwapStatus = (): Promise<TSwapStatusResponse> => {
  return apiGet('swap/status');
};

export const signSwap = (
  data: TSwapSignRequest,
): Promise<TSwapSignResponse> => {
  return apiPost('swap/sign', data);
};

// SPDX-License-Identifier: Apache-2.0

import type { CoinCode } from './account';
import { apiPost } from '@/utils/request';

export type TSwapQuoteRequest = {
  buyCoinCode: CoinCode;
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

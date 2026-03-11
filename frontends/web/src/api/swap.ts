// SPDX-License-Identifier: Apache-2.0

import { apiPost } from '@/utils/request';

export type TSwapQuoteRequest = {
  buyCoinCode: string;
  sellAmount: string;
  sellCoinCode: string;
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
  error: string;
  quote?: {
    error?: string;
  };
};

export const getSwapQuote = (
  data: TSwapQuoteRequest,
): Promise<TSwapQuoteResponse> => {
  return apiPost('swap/quote', data);
};

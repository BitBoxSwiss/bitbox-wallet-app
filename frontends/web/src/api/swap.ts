// SPDX-License-Identifier: Apache-2.0

import type { AccountCode } from './account';
import { apiPost } from '@/utils/request';

export type TSwapQuoteRequest = {
  buyAccountCode: AccountCode;
  sellAmount: string;
  sellAccountCode: AccountCode;
};

export type TSwapQuoteRoute = {
  routeId: string;
  expectedBuyAmount: string;
};

export type TSwapQuoteResponse = {
  success: true;
  routes: TSwapQuoteRoute[];
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

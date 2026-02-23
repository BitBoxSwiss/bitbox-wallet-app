// SPDX-License-Identifier: Apache-2.0

import type { AccountCode } from './account';
import { apiPost } from '@/utils/request';

export type TGetSwapQuote = {
  buyAsset: AccountCode;
  sellAmount: string;
  sellAsset: AccountCode;
};

export type TSwapResponse = {
  expectedBuyAmount: string;
};

export const getSwapQuote = (
  data: TGetSwapQuote,
): Promise<TSwapResponse> => {
  return apiPost('swap/quote', data);
};


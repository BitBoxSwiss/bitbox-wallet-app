// SPDX-License-Identifier: Apache-2.0

import type { CoinCode } from './account';
import { apiPost } from '@/utils/request';

export type TGetSwapQuote = {
  buyAsset: CoinCode;
  sellAmount: string;
  sellAsset: CoinCode;
};

export type TSwapResponse = {
  expectedBuyAmount: string;
};

export const getSwapQuote = (
  data: TGetSwapQuote,
): Promise<TSwapResponse> => {
  return apiPost('swap/quote', data);
};

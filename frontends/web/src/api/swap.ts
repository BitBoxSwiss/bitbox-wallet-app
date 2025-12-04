/**
 * Copyright 2025 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { FailResponse, SuccessResponse } from './response';
import type { AccountCode } from './account';
import { apiGet, apiPost } from '@/utils/request';
import { subscribeEndpoint, TUnsubscribe } from './subscribe';

export type TSwapQuotes = {
  quoteId: string;
  buyAsset: 'ETH.ETH';
  sellAsset: 'BTC.BTC';
  sellAmount: '0.001';
  // expectedBuyAmount;
  // expectedBuyAmountMaxSlippage;
  // fees: [];
  // routeId: string;
  // ...
  // expiration
  // estimatedTime
  // warnings: [];
  // targetAddress // so we can show the address in the app so the user can confirm with the one on the device
  // memo?
};

export const getSwapState = (): Promise<TSwapQuotes> => {
  return apiGet('swap/state');
};

export const syncSwapState = (
  cb: (state: TSwapQuotes) => void
): TUnsubscribe => {
  return subscribeEndpoint('swap/state', cb);
};

export type TProposeSwap = {
  buyAsset: AccountCode;
  sellAmount: string;
  sellAsset: AccountCode;
};

export const proposeSwap = (
  data: TProposeSwap,
): Promise<void> => {
  return apiPost('swap/quote', data);
};

type TSwapFailed = FailResponse & { aborted: boolean };
type TSwapExecutionResult = SuccessResponse | TSwapFailed;

export const executeSwap = (): Promise<TSwapExecutionResult> => {
  return apiPost('swap/execute');
};

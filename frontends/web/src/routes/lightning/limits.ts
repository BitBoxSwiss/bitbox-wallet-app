// SPDX-License-Identifier: Apache-2.0

import type { TLightningBalanceLimit } from '@/api/lightning';

export const lightningBalanceLimitErrorCode = 'lightningBalanceLimitExceeded' as const;

export const formatLightningBalanceLimit = (limit?: TLightningBalanceLimit): string => {
  return limit?.amountLabel || '';
};

export const formatRemainingLightningBalanceLimit = (limit?: TLightningBalanceLimit): string => {
  return limit?.remainingAmountLabel || '';
};

export const formatExcessLightningBalanceLimit = (limit?: TLightningBalanceLimit): string => {
  return limit?.excessAmountLabel || '';
};

export const hasReachedLightningBalanceLimit = (limit?: TLightningBalanceLimit): boolean => {
  return !!limit?.limitReached;
};

export const hasExceededLightningBalanceLimit = (limit?: TLightningBalanceLimit): boolean => {
  return !!limit?.limitExceeded;
};

export const getLightningBalanceLimitError = (
  limit?: TLightningBalanceLimit,
): typeof lightningBalanceLimitErrorCode | undefined => {
  return limit?.amountExceedsLimit ? lightningBalanceLimitErrorCode : undefined;
};

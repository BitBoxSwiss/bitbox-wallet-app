// SPDX-License-Identifier: Apache-2.0

import {
  lightningBalanceLimitErrorCode,
  type TLightningFundingLimit,
} from '@/api/lightning';

const formatSats = (amountSat: number): string => `${amountSat} sat`;

export const formatLightningFundingLimit = (limit?: TLightningFundingLimit): string => {
  return limit ? formatSats(limit.limitSat) : '';
};

export const formatRemainingLightningFundingLimit = (limit?: TLightningFundingLimit): string => {
  return limit ? formatSats(Math.max(limit.marginSat, 0)) : '';
};

export const formatExcessLightningFundingLimit = (
  limit?: TLightningFundingLimit,
  requestedAmountSat = 0,
): string => {
  return limit ? formatSats(Math.max(requestedAmountSat - limit.marginSat, 0)) : '';
};

export const hasReachedLightningFundingLimit = (limit?: TLightningFundingLimit): boolean => {
  return limit !== undefined && limit.marginSat <= 0;
};

export const hasExceededLightningFundingLimit = (limit?: TLightningFundingLimit): boolean => {
  return limit !== undefined && limit.marginSat < 0;
};

export const getLightningFundingLimitError = (
  limit?: TLightningFundingLimit,
  requestedAmountSat?: number | null,
): typeof lightningBalanceLimitErrorCode | undefined => {
  return limit !== undefined
    && requestedAmountSat !== undefined
    && requestedAmountSat !== null
    && requestedAmountSat > limit.marginSat
    ? lightningBalanceLimitErrorCode
    : undefined;
};

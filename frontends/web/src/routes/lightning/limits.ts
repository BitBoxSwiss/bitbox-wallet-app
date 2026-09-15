// SPDX-License-Identifier: Apache-2.0

import {
  lightningBalanceLimitErrorCode,
  type TLightningFundingLimit,
} from '@/api/lightning';

const formatSats = (amountSat: number | string): string => `${amountSat} sat`;

export const formatLightningFundingLimit = (limit?: TLightningFundingLimit): string => {
  return limit ? formatSats(limit.limitSat) : '';
};

export const formatRemainingLightningFundingLimit = (limit?: TLightningFundingLimit): string => {
  return limit ? formatSats(Math.max(limit.marginSat, 0)) : '';
};

export const formatExcessLightningFundingLimit = (
  limit?: TLightningFundingLimit,
  requestedAmountSat?: string,
): string => {
  // TODO: move to backend or use bigint
  const requestedAmountSatNumber = requestedAmountSat !== undefined ? Number(requestedAmountSat) : 0;
  return limit ? formatSats(Math.max(requestedAmountSatNumber - limit.marginSat, 0)) : '';
};

export const hasReachedLightningFundingLimit = (limit?: TLightningFundingLimit): boolean => {
  return limit !== undefined && limit.marginSat <= 0;
};

export const hasExceededLightningFundingLimit = (limit?: TLightningFundingLimit): boolean => {
  return limit !== undefined && limit.marginSat < 0;
};

export const getLightningFundingLimitError = (
  limit?: TLightningFundingLimit,
  requestedAmountSat?: string | null,
): typeof lightningBalanceLimitErrorCode | undefined => {
  return limit !== undefined
    && requestedAmountSat !== undefined
    && requestedAmountSat !== null
    // TODO: should be in backend or use bigint
    && Number(requestedAmountSat) > limit.marginSat
    ? lightningBalanceLimitErrorCode
    : undefined;
};

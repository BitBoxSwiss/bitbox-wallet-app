// SPDX-License-Identifier: Apache-2.0

import type { TMarketAction, TVendorName } from '@/api/market';

export const getMarketActionFromSearchParams = (
  searchParams: URLSearchParams,
): TMarketAction => {
  const tab = searchParams.get('tab');
  switch (tab) {
  case 'buy':
  case 'sell':
  case 'spend':
  case 'swap':
  case 'otc':
    return tab;
  default:
    return 'buy';
  }
};

/**
 * Gets formatted name for vendors.
 */
export const getVendorFormattedName = (
  name: TVendorName,
) => {
  switch (name) {
  case 'moonpay':
    return 'MoonPay';
  case 'pocket':
    return 'Pocket';
  case 'pocket-otc':
    return 'Pocket Private';
  case 'btcdirect':
  case 'btcdirect-otc':
    return 'BTC Direct';
  case 'bitrefill':
    return 'Bitrefill';
  case 'swapkit':
    return 'SwapKit';
  }
};

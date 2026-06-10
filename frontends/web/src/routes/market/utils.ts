// SPDX-License-Identifier: Apache-2.0

import type { TVendorName } from '@/api/market';
import type { TAccount } from '@/api/account';

export const getFallbackMarketAccountCode = (accounts: TAccount[]) => {
  return accounts.find(account => account.keystore.connected)?.code
    || accounts[0]?.code
    || '';
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

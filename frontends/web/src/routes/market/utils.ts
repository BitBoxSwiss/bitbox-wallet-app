// SPDX-License-Identifier: Apache-2.0

import { TVendorName } from '@/api/market';

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
  case 'btcdirect':
    return 'BTC Direct';
  case 'btcdirect-otc':
    return 'BTC Direct - Private Trading Desk';
  case 'bitrefill':
    return 'Bitrefill';
  case 'swapkit':
    return 'Swapkit';
  }
};

// SPDX-License-Identifier: Apache-2.0

import type { TVendorName } from '@/api/market';

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
  case 'pocket-otc':
    return 'Pocket';
  case 'btcdirect':
  case 'btcdirect-otc':
    return 'BTC Direct';
  case 'bitrefill':
    return 'Bitrefill';
  case 'swapkit':
    return 'SwapKit';
  }
};

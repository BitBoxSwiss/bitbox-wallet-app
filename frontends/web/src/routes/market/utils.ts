// SPDX-License-Identifier: Apache-2.0

import { TAccount } from '@/api/account';
import { getMarketVendors, TVendorName } from '@/api/market';

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

/**
 * Filters a given accounts list, keeping only the accounts supported by at least one vendor.
 */
export const getVendorSupportedAccounts = async (accounts: TAccount[]): Promise<TAccount[]> => {
  const accountsWithFalsyValue = await Promise.all(
    accounts.map(async (account) => {
      const supported = await getMarketVendors(account.code)();
      const hasBuySellSpendVendor = supported.vendors.some(vendor =>
        vendor === 'moonpay'
        || vendor === 'pocket'
        || vendor === 'btcdirect'
        || vendor === 'bitrefill');
      return hasBuySellSpendVendor ? account : false;
    })
  );
  return accountsWithFalsyValue.filter(result => result) as TAccount[];
};

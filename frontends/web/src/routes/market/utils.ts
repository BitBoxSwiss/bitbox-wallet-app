// SPDX-License-Identifier: Apache-2.0

import type { TMarketAction, TVendorName } from '@/api/market';
import type { CoinCode, TAccount } from '@/api/account';
import type { TKeystoreFeature } from '@/api/keystores';
import { isEthereumBased } from '@/routes/account/utils';

export const getFallbackMarketAccountCode = (accounts: TAccount[]) => {
  return accounts.find(account => account.keystore.connected)?.code
    || accounts[0]?.code
    || '';
};

const transactionSigningFeature = (coinCode: CoinCode): TKeystoreFeature => {
  return isEthereumBased(coinCode) ? 'ethTransactionSigning' : 'btcTransactionSigning';
};

export const getRequiredKeystoreFeature = (
  vendor: TVendorName,
  action: TMarketAction,
  coinCode?: CoinCode,
): TKeystoreFeature | undefined => {
  if (action === 'swap') {
    return 'swapPaymentRequests';
  }
  if (vendor === 'pocket' && action === 'buy') {
    return 'messageSigning';
  }
  if (vendor === 'pocket' && action === 'sell') {
    return 'paymentRequests';
  }
  if (vendor === 'btcdirect' && action === 'sell' && coinCode) {
    return transactionSigningFeature(coinCode);
  }
  if (vendor === 'bitrefill' && action === 'spend' && coinCode) {
    return transactionSigningFeature(coinCode);
  }
  return undefined;
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

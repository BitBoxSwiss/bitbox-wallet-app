// SPDX-License-Identifier: Apache-2.0

import type { CoinCode, CoinUnit } from '@/api/account';
import type { BtcUnit } from '@/api/coins';

export const isBitcoinOnly = (coinCode: CoinCode): boolean => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'rbtc':
    return true;
  default:
    return false;
  }
};

export const isBitcoinCoin = (coin: CoinUnit | undefined) => {
  switch (coin) {
  case 'BTC':
  case 'TBTC':
  case 'RBTC':
  case 'sat':
  case 'tsat':
    return true;
  default:
    return false;
  }
};

export const getDisplayedCoinUnit = (
  coinCode: CoinCode,
  coinUnit: CoinUnit,
  btcUnit: BtcUnit | undefined,
): CoinUnit => {
  if (!isBitcoinOnly(coinCode) || btcUnit !== 'sat') {
    return coinUnit;
  }
  return coinCode === 'tbtc' ? 'tsat' : 'sat';
};

export const isBitcoinBased = (coinCode: CoinCode): boolean => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'rbtc':
  case 'ltc':
  case 'tltc':
    return true;
  default:
    return false;
  }
};

export const isBitcoinCoinBased = (coin: CoinUnit): boolean => {
  switch (coin) {
  case 'BTC':
  case 'TBTC':
  case 'RBTC':
  case 'sat':
  case 'tsat':
  case 'LTC':
  case 'TLTC':
    return true;
  default:
    return false;
  }
};

export const isEthereumBased = (coinCode: CoinCode): boolean => {
  return coinCode === 'eth' || coinCode === 'sepeth' || coinCode.startsWith('eth-erc20-');
};

export const isMessageSigningSupported = (coinCode: CoinCode): boolean => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'eth':
  case 'sepeth':
  case 'rbtc':
    return true;
  default:
    return false;
  }
};

export const getAddressURIPrefix = (coinCode?: CoinCode): string => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'rbtc':
    return 'bitcoin:';
  case 'ltc':
  case 'tltc':
    return 'litecoin:';
  default:
    return '';
  }
};

export const getCoinCode = (coinCode: CoinCode): CoinCode | undefined => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'rbtc':
    return 'btc';
  case 'ltc':
  case 'tltc':
    return 'ltc';
  case 'eth':
  case 'sepeth':
    return 'eth';
  }
  if (coinCode.startsWith('eth-erc20-')) {
    return 'eth';
  }
};

export const customFeeUnit = (coinCode: CoinCode): string => {
  if (isBitcoinBased(coinCode)) {
    return 'sat/vB';
  }
  if (isEthereumBased(coinCode)) {
    return 'Gwei';
  }
  return '';
};

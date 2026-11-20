// SPDX-License-Identifier: Apache-2.0

import type { TCoinCode, TCoinUnit } from '@/api/account';
import type { BtcUnit } from '@/api/coins';

export const isBitcoinOnly = (coinCode: TCoinCode): boolean => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'rbtc':
  case 'lightning':
    return true;
  default:
    return false;
  }
};

export const isBitcoinCoin = (coin: TCoinUnit | undefined) => {
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
  coinCode: TCoinCode,
  coinUnit: TCoinUnit,
  btcUnit: BtcUnit | undefined,
): TCoinUnit => {
  if (!isBitcoinOnly(coinCode) || btcUnit !== 'sat') {
    return coinUnit;
  }
  return coinCode === 'tbtc' ? 'tsat' : 'sat';
};

export const isBitcoinBased = (coinCode: TCoinCode): boolean => {
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

export const isBitcoinCoinBased = (coin: TCoinUnit): boolean => {
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

export const isEthereumBased = (coinCode: TCoinCode): boolean => {
  return coinCode === 'eth' || coinCode === 'sepeth' || coinCode.startsWith('eth-erc20-');
};

export const isMessageSigningSupported = (coinCode: TCoinCode): boolean => {
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

export const getAddressURIPrefix = (coinCode?: TCoinCode): string => {
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

export const getCoinCode = (coinCode: TCoinCode): TCoinCode | undefined => {
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

export const customFeeUnit = (coinCode: TCoinCode): string => {
  if (isBitcoinBased(coinCode)) {
    return 'sat/vB';
  }
  if (isEthereumBased(coinCode)) {
    return 'Gwei';
  }
  return '';
};

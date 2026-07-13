// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { CoinCode, CoinUnit } from '@/api/account';
import {
  getAddressURIPrefix,
  getCoinCode,
  isBitcoinBased,
  isBitcoinCoin,
  isBitcoinCoinBased,
  isBitcoinOnly,
  isEthereumBased,
  isMessageSigningSupported,
} from './coin';

describe('utils/coin bitcoin helpers', () => {
  it('treats rbtc coin codes as bitcoin-only and bitcoin-based', () => {
    expect(isBitcoinOnly('rbtc')).toBe(true);
    expect(isBitcoinBased('rbtc')).toBe(true);
  });

  it('treats rbtc unit as bitcoin coin', () => {
    expect(isBitcoinCoin('RBTC' as CoinUnit)).toBe(true);
  });

  it('treats bitcoin and litecoin units as bitcoin-coin-based units', () => {
    expect(isBitcoinCoinBased('RBTC' as CoinUnit)).toBe(true);
    expect(isBitcoinCoinBased('TLTC' as CoinUnit)).toBe(true);
  });

  it('uses bitcoin URI prefix for rbtc', () => {
    expect(getAddressURIPrefix('rbtc')).toBe('bitcoin:');
  });

  it('maps rbtc to canonical btc coin code', () => {
    expect(getCoinCode('rbtc' as CoinCode)).toBe('btc');
  });
});

describe('utils/coin isEthereumBased', () => {
  it('matches native Ethereum and ERC20 coin codes', () => {
    expect(isEthereumBased('eth')).toBe(true);
    expect(isEthereumBased('sepeth')).toBe(true);
    expect(isEthereumBased('eth-erc20-usdc')).toBe(true);
  });

  it('does not match non-Ethereum coin codes', () => {
    expect(isEthereumBased('btc')).toBe(false);
    expect(isEthereumBased('ltc')).toBe(false);
  });
});

describe('utils/coin isMessageSigningSupported', () => {
  it('supports btc, tbtc and rbtc message signing', () => {
    expect(isMessageSigningSupported('btc')).toBe(true);
    expect(isMessageSigningSupported('tbtc')).toBe(true);
    expect(isMessageSigningSupported('rbtc')).toBe(true);
  });

  it('supports sepolia and eth message signing', () => {
    expect(isMessageSigningSupported('eth')).toBe(true);
    expect(isMessageSigningSupported('sepeth')).toBe(true);
  });

  it('does not support litecoin message signing', () => {
    expect(isMessageSigningSupported('ltc')).toBe(false);
    expect(isMessageSigningSupported('tltc')).toBe(false);
  });
});

// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { CoinCode, TAccount } from '@/api/account';
import {
  getConnectedSwapAccounts,
  getDefaultSwapPair,
  getDisabledAccountCodes,
  getFlippedAmounts,
  getPairKey,
  getPreferredBuyAccountCode,
  getPreferredSellAccountCode,
  getSelectedRouteId,
  reconcileSwapPair,
} from './services';

const makeAccount = ({
  code,
  coinCode,
  connected = true,
  isToken = false,
  rootFingerprint = 'f1',
}: {
  code: string;
  coinCode: CoinCode;
  connected?: boolean;
  isToken?: boolean;
  rootFingerprint?: string;
}): TAccount => ({
  keystore: {
    watchonly: false,
    rootFingerprint,
    name: `Keystore ${rootFingerprint}`,
    lastConnected: '',
    connected,
  },
  active: true,
  coinCode,
  coinUnit: 'ETH' as any,
  coinName: coinCode,
  code,
  name: code,
  isToken,
  blockExplorerTxPrefix: '',
});

describe('routes/market/swap/services', () => {
  it('returns only accounts from connected keystores', () => {
    const accounts = [
      makeAccount({ code: 'btc-connected', coinCode: 'btc', connected: true, rootFingerprint: 'f1' }),
      makeAccount({ code: 'eth-connected', coinCode: 'eth', connected: true, rootFingerprint: 'f1' }),
      makeAccount({ code: 'ltc-disconnected', coinCode: 'ltc', connected: false, rootFingerprint: 'f2' }),
    ];

    expect(getConnectedSwapAccounts(accounts).map(({ code }) => code)).toEqual([
      'btc-connected',
      'eth-connected',
    ]);
  });

  it('defaults to native ethereum selling and the first preferred bitcoin account', () => {
    const accounts = [
      makeAccount({ code: 'btc-other', coinCode: 'btc', rootFingerprint: 'f2' }),
      makeAccount({ code: 'eth-main', coinCode: 'eth', rootFingerprint: 'f1' }),
      makeAccount({ code: 'btc-same-keystore', coinCode: 'btc', rootFingerprint: 'f1' }),
    ];

    expect(getDefaultSwapPair(accounts)).toEqual({
      sellAccountCode: 'eth-main',
      buyAccountCode: 'btc-other',
    });
  });

  it('keeps the route sell account and resolves a valid counterpart', () => {
    const accounts = [
      makeAccount({ code: 'btc-same-keystore', coinCode: 'btc', rootFingerprint: 'f1' }),
      makeAccount({ code: 'ltc-route', coinCode: 'ltc', rootFingerprint: 'f1' }),
      makeAccount({ code: 'eth-other', coinCode: 'eth', rootFingerprint: 'f2' }),
    ];

    expect(getDefaultSwapPair(accounts, 'ltc-route')).toEqual({
      sellAccountCode: 'ltc-route',
      buyAccountCode: 'btc-same-keystore',
    });
  });

  it('falls back to the first valid cross-coin pair when no eth or btc account exists', () => {
    const accounts = [
      makeAccount({ code: 'ltc-main', coinCode: 'ltc' }),
      makeAccount({ code: 'usdc-main', coinCode: 'eth-erc20-usdc', isToken: true, rootFingerprint: 'f2' }),
    ];

    expect(getDefaultSwapPair(accounts)).toEqual({
      sellAccountCode: 'ltc-main',
      buyAccountCode: 'usdc-main',
    });
  });

  it('disables all accounts that share the opposite coin code', () => {
    const accounts = [
      makeAccount({ code: 'eth-1', coinCode: 'eth', rootFingerprint: 'f1' }),
      makeAccount({ code: 'eth-2', coinCode: 'eth', rootFingerprint: 'f2' }),
      makeAccount({ code: 'btc-1', coinCode: 'btc', rootFingerprint: 'f1' }),
    ];

    expect(getDisabledAccountCodes(accounts, 'eth-1')).toEqual(['eth-1', 'eth-2']);
  });

  it('keeps the current buy account when it is still a valid cross-coin pair', () => {
    const accounts = [
      makeAccount({ code: 'eth-1', coinCode: 'eth', rootFingerprint: 'f1' }),
      makeAccount({ code: 'btc-1', coinCode: 'btc', rootFingerprint: 'f1' }),
      makeAccount({ code: 'ltc-1', coinCode: 'ltc', rootFingerprint: 'f2' }),
    ];

    expect(getPreferredBuyAccountCode(accounts, 'eth-1', 'ltc-1')).toBe('ltc-1');
  });

  it('keeps the current sell account when it is still a valid cross-coin pair', () => {
    const accounts = [
      makeAccount({ code: 'eth-1', coinCode: 'eth', rootFingerprint: 'f1' }),
      makeAccount({ code: 'btc-1', coinCode: 'btc', rootFingerprint: 'f1' }),
      makeAccount({ code: 'ltc-1', coinCode: 'ltc', rootFingerprint: 'f2' }),
    ];

    expect(getPreferredSellAccountCode(accounts, 'eth-1', 'ltc-1')).toBe('ltc-1');
  });

  it('reconciles an invalid same-coin pair to a valid counterpart', () => {
    const accounts = [
      makeAccount({ code: 'eth-1', coinCode: 'eth', rootFingerprint: 'f1' }),
      makeAccount({ code: 'eth-2', coinCode: 'eth', rootFingerprint: 'f2' }),
      makeAccount({ code: 'btc-1', coinCode: 'btc', rootFingerprint: 'f1' }),
    ];

    expect(reconcileSwapPair(accounts, {
      sellAccountCode: 'eth-1',
      buyAccountCode: 'eth-2',
    })).toEqual({
      sellAccountCode: 'eth-1',
      buyAccountCode: 'btc-1',
    });
  });

  it('restores the previous pair amounts when flipping back', () => {
    const pairAmountsByKey = {
      [getPairKey('eth-1', 'btc-1') || '']: {
        sellAmount: '1',
        expectedOutput: '30',
      },
      [getPairKey('btc-1', 'eth-1') || '']: {
        sellAmount: '30',
        expectedOutput: '0.98',
      },
    };

    expect(getFlippedAmounts(pairAmountsByKey, 'btc-1', 'eth-1', '30', '0.98')).toEqual({
      sellAmount: '1',
      expectedOutput: '30',
    });
  });

  it('keeps the existing route selection if it is still available', () => {
    expect(getSelectedRouteId([
      { routeId: 'route-1', expectedBuyAmount: '10' },
      { routeId: 'route-2', expectedBuyAmount: '9' },
    ], 'route-2')).toBe('route-2');
  });

  it('defaults to the first route when there is no current selection', () => {
    expect(getSelectedRouteId([
      { routeId: 'route-1', expectedBuyAmount: '10' },
      { routeId: 'route-2', expectedBuyAmount: '9' },
    ])).toBe('route-1');
  });
});

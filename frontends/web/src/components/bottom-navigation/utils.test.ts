// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { TAccount } from '@/api/account';
import { getBottomNavKey, shouldShowBottomNavigation } from './utils';

const activeAccount = { active: true } as TAccount;

describe('getBottomNavKey', () => {
  it('maps marketplace routes to the market tab', () => {
    expect(getBottomNavKey('/market/select')).toBe('market');
    expect(getBottomNavKey('/market/moonpay/buy/btc')).toBe('market');
    expect(getBottomNavKey('/market/btcdirect/sell/btc/CH')).toBe('market');
    expect(getBottomNavKey('/market/bitrefill/spend/btc')).toBe('market');
    expect(getBottomNavKey('/market/pocket/buy/btc')).toBe('market');
  });
});

describe('shouldShowBottomNavigation', () => {
  it('hides on the welcome route when only a device is registered', () => {
    expect(shouldShowBottomNavigation({
      activeAccounts: [],
      devices: { deviceID: 'bitbox02' },
      pathname: '/',
    })).toBe(false);
  });

  it('shows outside the welcome route when a device is registered without accounts', () => {
    expect(shouldShowBottomNavigation({
      activeAccounts: [],
      devices: { deviceID: 'bitbox02' },
      pathname: '/settings',
    })).toBe(true);
  });

  it('shows on the welcome route when accounts exist', () => {
    expect(shouldShowBottomNavigation({
      activeAccounts: [activeAccount],
      devices: {},
      pathname: '/',
    })).toBe(true);
  });

  it('hides for the BitBox02 bootloader', () => {
    expect(shouldShowBottomNavigation({
      activeAccounts: [activeAccount],
      devices: { deviceID: 'bitbox02-bootloader' },
      pathname: '/settings/device-settings/deviceID',
    })).toBe(false);
  });
});

// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { TAccount } from '@/api/account';
import { getBottomNavIndex, getBottomNavItems, getBottomNavKey, shouldShowBottomNavigation } from './utils';

const activeAccount = { active: true } as TAccount;

describe('getBottomNavKey', () => {
  it('maps Lightning wallet routes to the Lightning tab', () => {
    expect(getBottomNavKey('/lightning')).toBe('lightning');
    expect(getBottomNavKey('/lightning/send')).toBe('lightning');
    expect(getBottomNavKey('/lightning/receive')).toBe('lightning');
    expect(getBottomNavKey('/lightning/topup')).toBe('lightning');
  });

  it('maps Lightning setup routes to the settings tab', () => {
    expect(getBottomNavKey('/lightning/activate')).toBe('settings');
    expect(getBottomNavKey('/lightning/disclaimer')).toBe('settings');
    expect(getBottomNavKey('/lightning/deactivate')).toBe('settings');
    expect(getBottomNavKey('/lightning/set-lnurl-address')).toBe('settings');
    expect(getBottomNavKey('/lightning/close-withdraw-funds')).toBe('settings');
  });

  it('maps marketplace routes to the market tab', () => {
    expect(getBottomNavKey('/market/select')).toBe('market');
    expect(getBottomNavKey('/market/moonpay/buy/btc')).toBe('market');
    expect(getBottomNavKey('/market/btcdirect/sell/btc/CH')).toBe('market');
    expect(getBottomNavKey('/market/bitrefill/spend/btc')).toBe('market');
    expect(getBottomNavKey('/market/pocket/buy/btc')).toBe('market');
  });

  it('maps settings routes to the settings tab', () => {
    expect(getBottomNavKey('/settings')).toBe('settings');
    expect(getBottomNavKey('/settings/general')).toBe('settings');
    expect(getBottomNavKey('/settings/device-settings/deviceID')).toBe('settings');
  });
});

describe('getBottomNavIndex', () => {
  it('maps bottom-navigation keys to their visible tab indexes', () => {
    expect(getBottomNavIndex('portfolio')).toBe(0);
    expect(getBottomNavIndex('accounts')).toBe(1);
    expect(getBottomNavIndex('lightning')).toBe(2);
    expect(getBottomNavIndex('market')).toBe(3);
    expect(getBottomNavIndex('settings')).toBe(4);
    expect(getBottomNavIndex('other')).toBeUndefined();
  });

  it('maps indexes when the Lightning shortcut is visible', () => {
    const items = getBottomNavItems({
      hasLightningAccount: true,
      showAccounts: true,
      showMarket: true,
    });

    expect(getBottomNavIndex('portfolio', items)).toBe(0);
    expect(getBottomNavIndex('accounts', items)).toBe(1);
    expect(getBottomNavIndex('lightning', items)).toBe(2);
    expect(getBottomNavIndex('market', items)).toBe(3);
    expect(getBottomNavIndex('settings', items)).toBe(4);
  });

  it('skips the market index when the market tab is hidden', () => {
    const items = getBottomNavItems({
      hasLightningAccount: true,
      showAccounts: true,
      showMarket: false,
    });

    expect(getBottomNavIndex('lightning', items)).toBe(2);
    expect(getBottomNavIndex('market', items)).toBeUndefined();
    expect(getBottomNavIndex('settings', items)).toBe(3);
  });

  it('skips the accounts index when only the Lightning shortcut is visible', () => {
    const items = getBottomNavItems({
      hasLightningAccount: true,
      showAccounts: false,
      showMarket: false,
    });

    expect(getBottomNavIndex('accounts', items)).toBeUndefined();
    expect(getBottomNavIndex('lightning', items)).toBe(1);
    expect(getBottomNavIndex('settings', items)).toBe(2);
  });

  it('keeps the accounts index visible when no wallets are active', () => {
    const items = getBottomNavItems({
      hasLightningAccount: false,
      showAccounts: true,
      showMarket: true,
    });

    expect(getBottomNavIndex('accounts', items)).toBe(1);
    expect(getBottomNavIndex('market', items)).toBe(2);
    expect(getBottomNavIndex('settings', items)).toBe(3);
  });
});

describe('shouldShowBottomNavigation', () => {
  it('hides on the welcome route when only a device is registered', () => {
    expect(shouldShowBottomNavigation({
      activeAccounts: [],
      devices: { deviceID: 'bitbox02' },
      hasLightningAccount: false,
      pathname: '/',
    })).toBe(false);
  });

  it('shows outside the welcome route when a device is registered without accounts', () => {
    expect(shouldShowBottomNavigation({
      activeAccounts: [],
      devices: { deviceID: 'bitbox02' },
      hasLightningAccount: false,
      pathname: '/settings',
    })).toBe(true);
  });

  it('shows on the welcome route when accounts exist', () => {
    expect(shouldShowBottomNavigation({
      activeAccounts: [activeAccount],
      devices: {},
      hasLightningAccount: false,
      pathname: '/',
    })).toBe(true);
  });

  it('hides for the BitBox02 bootloader', () => {
    expect(shouldShowBottomNavigation({
      activeAccounts: [activeAccount],
      devices: { deviceID: 'bitbox02-bootloader' },
      hasLightningAccount: false,
      pathname: '/settings/device-settings/deviceID',
    })).toBe(false);
  });

  it('hides when any connected device is a BitBox02 bootloader', () => {
    expect(shouldShowBottomNavigation({
      activeAccounts: [activeAccount],
      devices: {
        deviceID: 'bitbox02',
        bootloaderDeviceID: 'bitbox02-bootloader',
      },
      hasLightningAccount: false,
      pathname: '/settings/device-settings/deviceID',
    })).toBe(false);
  });

  it('shows on the welcome route when only a Lightning account exists', () => {
    expect(shouldShowBottomNavigation({
      activeAccounts: [],
      devices: {},
      hasLightningAccount: true,
      pathname: '/',
    })).toBe(true);
  });
});

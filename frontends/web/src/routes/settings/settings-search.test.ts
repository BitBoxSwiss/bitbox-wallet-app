// SPDX-License-Identifier: Apache-2.0

import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  filterSettingsSearchItems,
  getSettingsSearchItems,
} from './settings-search';

const isLightningFeatureAvailableMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('@/utils/env', () => ({
  debug: false,
  isLightningFeatureAvailable: isLightningFeatureAvailableMock,
  runningInAndroid: () => false,
  runningInIOS: () => false,
}));

const translations: Record<string, string> = {
  'lightning.settings.enableWallet': 'Enable lightning wallet',
  'lightning.settings.title': 'Lightning settings',
  'testnet.activate.title': 'Activate testnet',
  'testnet.deactivate.title': 'Deactivate testnet',
  'testWallet.connect.title': 'Test wallet',
  'testWallet.disconnect.title': 'Disconnect test wallet',
};

const t = ((key: string) => translations[key] || key) as TFunction;

const getItems = (
  hasSoftwareKeystore: boolean,
  isLightningEnabled: boolean | undefined,
) => getSettingsSearchItems({
  devices: {},
  hasAccounts: true,
  hasSoftwareKeystore,
  isLightningEnabled,
  isTesting: true,
  t,
});

describe('settings search', () => {
  beforeEach(() => {
    isLightningFeatureAvailableMock.mockReturnValue(true);
  });

  it.each([
    { isTesting: undefined, title: undefined },
    { isTesting: false, title: 'Activate testnet' },
    { isTesting: true, title: 'Deactivate testnet' },
  ])('shows the correct testnet setting for isTesting=$isTesting', ({ isTesting, title }) => {
    const items = getSettingsSearchItems({
      devices: {},
      hasAccounts: true,
      hasSoftwareKeystore: false,
      isLightningEnabled: true,
      isTesting,
      t,
    });

    expect(items.find(item => item.id === 'testnet-mode')).toEqual(title === undefined ? undefined : {
      id: 'testnet-mode',
      page: 'advanced',
      title,
    });
  });

  it('uses the connect title for the test wallet setting when no software wallet exists', () => {
    const results = filterSettingsSearchItems(getItems(false, true), 'test wallet');

    expect(results).toContainEqual({
      id: 'test-wallet',
      page: 'advanced',
      title: 'Test wallet',
    });
    expect(filterSettingsSearchItems(getItems(false, true), 'disconnect')).toEqual([]);
  });

  it('uses the disconnect title for the test wallet setting when a software wallet exists', () => {
    const results = filterSettingsSearchItems(getItems(true, true), 'disconnect');

    expect(results).toEqual([{
      id: 'test-wallet',
      page: 'advanced',
      title: 'Disconnect test wallet',
    }]);
  });

  it('uses the lightning settings title when lightning is enabled', () => {
    const results = filterSettingsSearchItems(getItems(false, true), 'lightning settings');

    expect(results).toContainEqual({
      id: 'lightning-settings',
      page: 'advanced',
      title: 'Lightning settings',
    });
  });

  it('uses the enable lightning wallet title when lightning is disabled', () => {
    const results = filterSettingsSearchItems(getItems(false, false), 'enable lightning wallet');

    expect(results).toContainEqual({
      id: 'lightning-settings',
      page: 'advanced',
      title: 'Enable lightning wallet',
    });
  });

  it('hides the lightning setting while its state is loading', () => {
    const results = filterSettingsSearchItems(getItems(false, undefined), 'lightning');

    expect(results).toEqual([]);
  });

  it('hides the lightning setting when the lightning feature is unavailable', () => {
    isLightningFeatureAvailableMock.mockReturnValue(false);

    const results = filterSettingsSearchItems(getItems(false, true), 'lightning');

    expect(results).toEqual([]);
  });
});

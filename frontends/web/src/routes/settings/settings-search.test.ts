// SPDX-License-Identifier: Apache-2.0

import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import {
  filterSettingsSearchItems,
  getSettingsSearchItems,
} from './settings-search';

vi.mock('@/utils/env', () => ({
  debug: false,
  runningInAndroid: () => false,
  runningInIOS: () => false,
}));

const translations: Record<string, string> = {
  'lightning.settings.title': 'Lightning settings',
  'testWallet.connect.title': 'Test wallet',
  'testWallet.disconnect.title': 'Disconnect test wallet',
};

const t = ((key: string) => translations[key] || key) as TFunction;

const getItems = (hasSoftwareKeystore: boolean) => getSettingsSearchItems({
  devices: {},
  hasAccounts: true,
  hasSoftwareKeystore,
  isTesting: true,
  t,
});

describe('settings search', () => {
  it('uses the connect title for the test wallet setting when no software wallet exists', () => {
    const results = filterSettingsSearchItems(getItems(false), 'test wallet');

    expect(results).toContainEqual({
      id: 'test-wallet',
      page: 'advanced',
      title: 'Test wallet',
    });
    expect(filterSettingsSearchItems(getItems(false), 'disconnect')).toEqual([]);
  });

  it('uses the disconnect title for the test wallet setting when a software wallet exists', () => {
    const results = filterSettingsSearchItems(getItems(true), 'disconnect');

    expect(results).toEqual([{
      id: 'test-wallet',
      page: 'advanced',
      title: 'Disconnect test wallet',
    }]);
  });

  it('includes the lightning settings row without a lightning account', () => {
    const results = filterSettingsSearchItems(getItems(false), 'lightning settings');

    expect(results).toContainEqual({
      id: 'lightning-settings',
      page: 'advanced',
      title: 'Lightning settings',
    });
  });
});

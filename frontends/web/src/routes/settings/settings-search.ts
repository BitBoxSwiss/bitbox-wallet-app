// SPDX-License-Identifier: Apache-2.0

import type { TFunction } from 'i18next';
import type { DeviceInfo } from '@/api/bitbox02';
import type { TDevices } from '@/api/devices';
import {
  isBluetoothToggleSettingVisible,
  isDeviceBluetoothSupported,
  isDeviceSettingsVisible,
  isExportLogsSettingVisible,
  isNotesSettingsVisible,
  isScreenLockSettingVisible,
  isTestWalletSettingVisible,
} from './settings-availability';

export type TSettingsSearchItem = {
  id: string;
  title: string;
  page: TSettingsSearchPage;
};

type TGetSettingsSearchItemsArgs = {
  deviceInfo?: DeviceInfo;
  devices: TDevices;
  hasAccounts: boolean;
  hasSoftwareKeystore: boolean;
  isTesting: boolean;
  t: TFunction;
};

export type TSettingsSearchPage = 'general' | 'device' | 'advanced' | 'about';

export const SETTINGS_SEARCH_PAGE_ORDER: TSettingsSearchPage[] = ['general', 'device', 'advanced', 'about'];
export const SETTINGS_HIGHLIGHT_QUERY_PARAM = 'settingsHighlight';

type TSettingsSearchContext = TGetSettingsSearchItemsArgs & {
  deviceIDs: string[];
};

type TSettingsSearchDescriptor = {
  id: string;
  page: TSettingsSearchPage;
  getTitle: (context: TSettingsSearchContext) => string;
  isAvailable?: (context: TSettingsSearchContext) => boolean;
};

const SETTINGS_SEARCH_DESCRIPTORS: TSettingsSearchDescriptor[] = [
  {
    id: 'language',
    getTitle: ({ t }) => t('newSettings.appearance.language.title'),
    page: 'general',
  },
  {
    id: 'default-currency',
    getTitle: ({ t }) => t('newSettings.appearance.defaultCurrency.title'),
    page: 'general',
  },
  {
    id: 'active-currencies',
    getTitle: ({ t }) => t('newSettings.appearance.activeCurrencies.title'),
    page: 'general',
  },
  {
    id: 'dark-mode',
    getTitle: ({ t }) => t('darkmode.toggle'),
    page: 'general',
  },
  {
    id: 'custom-fees',
    getTitle: ({ t }) => t('settings.expert.fee'),
    page: 'advanced',
  },
  {
    id: 'coin-control',
    getTitle: ({ t }) => t('settings.expert.coinControl'),
    page: 'advanced',
  },
  {
    id: 'screen-lock',
    isAvailable: isScreenLockSettingVisible,
    getTitle: ({ t }) => t('newSettings.advancedSettings.authentication.title'),
    page: 'advanced',
  },
  {
    id: 'tor-proxy',
    getTitle: ({ t }) => t('settings.expert.useProxy'),
    page: 'advanced',
  },
  {
    id: 'onion-explorer',
    getTitle: ({ t }) => t('settings.expert.onionExplorer'),
    page: 'advanced',
  },
  {
    id: 'testnet-mode',
    getTitle: ({ isTesting, t }) => isTesting ? t('testnet.deactivate.title') : t('testnet.activate.title'),
    page: 'advanced',
  },
  {
    id: 'gap-limit',
    getTitle: ({ t }) => t('gapLimit.title'),
    page: 'advanced',
  },
  {
    id: 'full-node',
    getTitle: ({ t }) => t('settings.expert.electrum.title'),
    page: 'advanced',
  },
  {
    id: 'export-logs',
    isAvailable: isExportLogsSettingVisible,
    getTitle: ({ t }) => t('settings.expert.exportLogs.title'),
    page: 'advanced',
  },
  {
    id: 'app-version',
    getTitle: ({ t }) => t('newSettings.about.appVersion.title'),
    page: 'about',
  },
  {
    id: 'feedback',
    getTitle: ({ t }) => t('newSettings.about.feedbackLink.title'),
    page: 'about',
  },
  {
    id: 'support',
    getTitle: ({ t }) => t('newSettings.about.supportLink.title'),
    page: 'about',
  },
  {
    id: 'export-notes',
    isAvailable: ({ hasAccounts }) => isNotesSettingsVisible(hasAccounts),
    getTitle: ({ t }) => t('settings.notes.export.title'),
    page: 'general',
  },
  {
    id: 'import-notes',
    isAvailable: ({ hasAccounts }) => isNotesSettingsVisible(hasAccounts),
    getTitle: ({ t }) => t('settings.notes.import.title'),
    page: 'general',
  },
  {
    id: 'test-wallet',
    isAvailable: ({ deviceIDs, isTesting }) => isTestWalletSettingVisible({ deviceIDs, isTesting }),
    getTitle: ({ hasSoftwareKeystore, t }) => t(
      hasSoftwareKeystore
        ? 'testWallet.disconnect.title'
        : 'testWallet.connect.title'
    ),
    page: 'advanced',
  },
  {
    id: 'manage-backups',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('backup.title'),
    page: 'device',
  },
  {
    id: 'show-recovery-words',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('backup.showMnemonic.title'),
    page: 'device',
  },
  {
    id: 'device-name',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('bitbox02Settings.deviceName.input'),
    page: 'device',
  },
  {
    id: 'bluetooth',
    isAvailable: ({ deviceInfo }) => isBluetoothToggleSettingVisible(deviceInfo),
    getTitle: ({ t }) => t('bitbox02Settings.bluetoothToggleEnabled.titleEnabled'),
    page: 'device',
  },
  {
    id: 'device-password',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('bitbox02Settings.changePassword.title'),
    page: 'device',
  },
  {
    id: 'firmware',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.firmware.title'),
    page: 'device',
  },
  {
    id: 'bluetooth-firmware',
    isAvailable: ({ deviceInfo }) => isDeviceBluetoothSupported(deviceInfo),
    getTitle: ({ t }) => t('deviceSettings.bluetoothFirmware.title'),
    page: 'device',
  },
  {
    id: 'authenticity-check',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.hardware.attestation.label'),
    page: 'device',
  },
  {
    id: 'root-fingerprint',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: () => 'Root fingerprint',
    page: 'device',
  },
  {
    id: 'secure-chip',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.hardware.securechip'),
    page: 'device',
  },
  {
    id: 'passphrase',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.expert.passphrase.title'),
    page: 'device',
  },
  {
    id: 'bip85',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.expert.bip85.title'),
    page: 'device',
  },
  {
    id: 'startup-settings',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('bitbox02Settings.gotoStartupSettings.title'),
    page: 'device',
  },
  {
    id: 'factory-reset',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.expert.factoryReset.title'),
    page: 'device',
  },
];

export const getSettingsSearchItems = ({
  deviceInfo,
  devices,
  hasAccounts,
  hasSoftwareKeystore,
  isTesting,
  t,
}: TGetSettingsSearchItemsArgs): TSettingsSearchItem[] => {
  const context = {
    deviceInfo,
    devices,
    deviceIDs: Object.keys(devices),
    hasAccounts,
    hasSoftwareKeystore,
    isTesting,
    t,
  };

  return SETTINGS_SEARCH_DESCRIPTORS
    .filter(descriptor => descriptor.isAvailable ? descriptor.isAvailable(context) : true)
    .map(descriptor => ({
      id: descriptor.id,
      title: descriptor.getTitle(context),
      page: descriptor.page,
    }));
};


export const filterSettingsSearchItems = (
  searchItems: TSettingsSearchItem[],
  searchTerm: string,
): TSettingsSearchItem[] => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  if (!normalizedSearchTerm) {
    return [];
  }
  return searchItems.filter(searchItem => (
    searchItem.title.trim().toLowerCase().includes(normalizedSearchTerm)
  ));
};

export const groupSearchResultsByPage = (searchResults: TSettingsSearchItem[]) => {
  const searchResultsByPage: Record<TSettingsSearchPage, TSettingsSearchItem[]> = {
    about: [],
    advanced: [],
    device: [],
    general: [],
  };

  searchResults.forEach(searchResult => {
    searchResultsByPage[searchResult.page].push(searchResult);
  });

  return searchResultsByPage;
};

export const SETTINGS_SEARCH_QUERY_PARAM = 'settingsSearch';

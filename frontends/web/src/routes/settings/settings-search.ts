// SPDX-License-Identifier: Apache-2.0

import type { TFunction } from 'i18next';
import type { DeviceInfo } from '@/api/bitbox02';
import type { TDevices } from '@/api/devices';
import {
  isBluetoothToggleSettingVisible,
  isDeviceBluetoothSupported,
  isDeviceLanguageSupported,
  isDeviceSettingsVisible,
  isExportLogsSettingVisible,
  isLightningSettingVisible,
  isNotesSettingsVisible,
  isScreenLockSettingVisible,
  isTestWalletSettingVisible,
} from './settings-availability';

export type TSettingsSearchItem = {
  id: string;
  title: string;
  description: string;
  page: TSettingsSearchPage;
};

type TGetSettingsSearchItemsArgs = {
  deviceInfo?: DeviceInfo;
  devices: TDevices;
  hasAccounts: boolean;
  isLightningEnabled: boolean | undefined;
  hasSoftwareKeystore: boolean;
  isTesting: boolean | undefined;
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
  getDescription: (context: TSettingsSearchContext) => string;
  isAvailable?: (context: TSettingsSearchContext) => boolean;
};

const SETTINGS_SEARCH_DESCRIPTORS: TSettingsSearchDescriptor[] = [
  {
    id: 'language',
    getTitle: ({ t }) => t('newSettings.appearance.language.title'),
    getDescription: ({ t }) => t('newSettings.appearance.language.description'),
    page: 'general',
  },
  {
    id: 'default-currency',
    getTitle: ({ t }) => t('newSettings.appearance.defaultCurrency.title'),
    getDescription: ({ t }) => t('newSettings.appearance.defaultCurrency.description'),
    page: 'general',
  },
  {
    id: 'active-currencies',
    getTitle: ({ t }) => t('newSettings.appearance.activeCurrencies.title'),
    getDescription: ({ t }) => t('newSettings.appearance.activeCurrencies.description'),
    page: 'general',
  },
  {
    id: 'dark-mode',
    getTitle: ({ t }) => t('darkmode.toggle'),
    getDescription: ({ t }) => t('newSettings.appearance.darkmode.description'),
    page: 'general',
  },
  {
    id: 'custom-fees',
    getTitle: ({ t }) => t('settings.expert.fee'),
    getDescription: ({ t }) => t('newSettings.advancedSettings.customFees.description'),
    page: 'advanced',
  },
  {
    id: 'coin-control',
    getTitle: ({ t }) => t('settings.expert.coinControl'),
    getDescription: ({ t }) => t('newSettings.advancedSettings.coinControl.description'),
    page: 'advanced',
  },
  {
    id: 'screen-lock',
    isAvailable: isScreenLockSettingVisible,
    getTitle: ({ t }) => t('newSettings.advancedSettings.authentication.title'),
    getDescription: ({ t }) => t('newSettings.advancedSettings.authentication.description'),
    page: 'advanced',
  },
  {
    id: 'tor-proxy',
    getTitle: ({ t }) => t('settings.expert.useProxy'),
    getDescription: ({ t }) => t('newSettings.advancedSettings.torProxy.description'),
    page: 'advanced',
  },
  {
    id: 'testnet-mode',
    isAvailable: ({ isTesting }) => isTesting !== undefined,
    getTitle: ({ isTesting, t }) => (
      isTesting
        ? t('testnet.deactivate.title')
        : t('testnet.activate.title')
    ),
    getDescription: ({ isTesting, t }) => (
      isTesting
        ? t('testnet.deactivate.description')
        : t('testnet.activate.description')
    ),
    page: 'advanced',
  },
  {
    id: 'gap-limit',
    getTitle: ({ t }) => t('gapLimit.title'),
    getDescription: ({ t }) => t('gapLimit.description'),
    page: 'advanced',
  },
  {
    id: 'full-node',
    getTitle: ({ t }) => t('settings.expert.electrum.title'),
    getDescription: ({ t }) => t('settings.expert.electrum.description'),
    page: 'advanced',
  },
  {
    id: 'clear-cache',
    getTitle: ({ t }) => t('settings.expert.clearCache.title'),
    getDescription: ({ t }) => t('settings.expert.clearCache.description'),
    page: 'advanced',
  },
  {
    id: 'lightning-settings',
    isAvailable: ({ isLightningEnabled }) => isLightningSettingVisible(isLightningEnabled),
    getTitle: ({ isLightningEnabled, t }) => (
      isLightningEnabled
        ? t('lightning.settings.title')
        : t('lightning.settings.enableWallet')
    ),
    getDescription: ({ isLightningEnabled, t }) => (
      isLightningEnabled
        ? ''
        : t('lightning.settings.enableWalletDescription')
    ),
    page: 'advanced',
  },
  {
    id: 'export-logs',
    isAvailable: isExportLogsSettingVisible,
    getTitle: ({ t }) => t('settings.expert.exportLogs.title'),
    getDescription: ({ t }) => t('settings.expert.exportLogs.description'),
    page: 'advanced',
  },
  {
    id: 'app-version',
    getTitle: ({ t }) => t('newSettings.about.appVersion.title'),
    getDescription: () => '', // ignoring conditional string as update info is not available here
    page: 'about',
  },
  {
    id: 'feedback',
    getTitle: ({ t }) => t('newSettings.about.feedbackLink.title'),
    getDescription: ({ t }) => t('newSettings.about.feedbackLink.description'),
    page: 'about',
  },
  {
    id: 'support',
    getTitle: ({ t }) => t('newSettings.about.supportLink.title'),
    getDescription: ({ t }) => t('newSettings.about.supportLink.description'),
    page: 'about',
  },
  {
    id: 'export-notes',
    isAvailable: ({ hasAccounts, isLightningEnabled }) => isNotesSettingsVisible(hasAccounts, isLightningEnabled),
    getTitle: ({ t }) => t('settings.notes.export.title'),
    getDescription: ({ t }) => t('settings.notes.export.description'),
    page: 'general',
  },
  {
    id: 'import-notes',
    isAvailable: ({ hasAccounts, isLightningEnabled }) => isNotesSettingsVisible(hasAccounts, isLightningEnabled),
    getTitle: ({ t }) => t('settings.notes.import.title'),
    getDescription: ({ t }) => t('settings.notes.import.description'),
    page: 'general',
  },
  {
    id: 'test-wallet',
    isAvailable: ({ deviceIDs, isTesting }) => isTestWalletSettingVisible({ deviceIDs, isTesting }),
    getTitle: ({ hasSoftwareKeystore, t }) => (
      hasSoftwareKeystore
        ? t('testWallet.disconnect.title')
        : t('testWallet.connect.title')
    ),
    getDescription: ({ hasSoftwareKeystore, t }) => (
      hasSoftwareKeystore
        ? t('testWallet.disconnect.description')
        : t('testWallet.connect.description')
    ),
    page: 'advanced',
  },
  {
    id: 'manage-backups',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('backup.title'),
    getDescription: ({ t }) => t('deviceSettings.backups.manageBackups.description'),
    page: 'device',
  },
  {
    id: 'show-recovery-words',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('backup.showMnemonic.title'),
    getDescription: ({ t }) => t('deviceSettings.backups.showRecoveryWords.description'),
    page: 'device',
  },
  {
    id: 'device-name',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('bitbox02Settings.deviceName.input'),
    getDescription: ({ t }) => t('deviceSettings.deviceInformation.deviceName.description'),
    page: 'device',
  },
  {
    id: 'device-language',
    isAvailable: ({ deviceInfo }) => isDeviceLanguageSupported(deviceInfo),
    getTitle: ({ t }) => t('deviceSettings.deviceLanguage.title'),
    getDescription: ({ t }) => t('deviceSettings.deviceLanguage.description'),
    page: 'device',
  },
  {
    id: 'bluetooth',
    isAvailable: ({ deviceInfo }) => isBluetoothToggleSettingVisible(deviceInfo),
    getTitle: ({ t }) => t('bitbox02Settings.bluetoothToggleEnabled.titleEnabled'),
    getDescription: ({ t }) => t('bitbox02Settings.bluetoothToggleEnabled.description'),
    page: 'device',
  },
  {
    id: 'device-password',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('bitbox02Settings.changePassword.title'),
    getDescription: ({ t }) => t('bitbox02Settings.changePassword.description'),
    page: 'device',
  },
  {
    id: 'firmware',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.firmware.title'),
    getDescription: () => '', // ignoring as it depends on canUpgrade which is not available here
    page: 'device',
  },
  {
    id: 'bluetooth-firmware',
    isAvailable: ({ deviceInfo }) => isDeviceBluetoothSupported(deviceInfo),
    getTitle: ({ t }) => t('deviceSettings.bluetoothFirmware.title'),
    getDescription: () => '', // ignoring as it depends on canUpgrade which is not available here
    page: 'device',
  },
  {
    id: 'authenticity-check',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.hardware.attestation.label'),
    getDescription: ({ t }) => t('deviceSettings.deviceInformation.attestation.description'),
    page: 'device',
  },
  {
    id: 'root-fingerprint',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: () => 'Root fingerprint',
    getDescription: ({ t }) => t('deviceSettings.deviceInformation.rootFingerprint.description'),
    page: 'device',
  },
  {
    id: 'secure-chip',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.hardware.securechip'),
    getDescription: ({ t }) => t('deviceSettings.deviceInformation.securechip.description'),
    page: 'device',
  },
  {
    id: 'passphrase',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.expert.passphrase.title'),
    getDescription: ({ t }) => t('deviceSettings.expert.passphrase.description'),
    page: 'device',
  },
  {
    id: 'bip85',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.expert.bip85.title'),
    getDescription: ({ t }) => t('deviceSettings.expert.bip85.description'),
    page: 'device',
  },
  {
    id: 'startup-settings',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('bitbox02Settings.gotoStartupSettings.title'),
    getDescription: ({ t }) => t('deviceSettings.expert.goToStartupSettings.description'),
    page: 'device',
  },
  {
    id: 'factory-reset',
    isAvailable: ({ devices }) => isDeviceSettingsVisible(devices),
    getTitle: ({ t }) => t('deviceSettings.expert.factoryReset.title'),
    getDescription: ({ t }) => t('deviceSettings.expert.factoryReset.description'),
    page: 'device',
  },
];

export const getSettingsSearchItems = ({
  deviceInfo,
  devices,
  hasAccounts,
  isLightningEnabled,
  hasSoftwareKeystore,
  isTesting,
  t,
}: TGetSettingsSearchItemsArgs): TSettingsSearchItem[] => {
  const context = {
    deviceInfo,
    devices,
    deviceIDs: Object.keys(devices),
    hasAccounts,
    isLightningEnabled,
    hasSoftwareKeystore,
    isTesting,
    t,
  };

  return SETTINGS_SEARCH_DESCRIPTORS
    .filter(descriptor => descriptor.isAvailable ? descriptor.isAvailable(context) : true)
    .map(descriptor => ({
      id: descriptor.id,
      title: descriptor.getTitle(context),
      description: descriptor.getDescription(context),
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
    || searchItem.description.trim().toLowerCase().includes(normalizedSearchTerm)
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

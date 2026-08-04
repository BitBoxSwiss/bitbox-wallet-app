// SPDX-License-Identifier: Apache-2.0

import type { TAccount } from '@/api/account';
import type { TDevices } from '@/api/devices';

const bottomNavKeys = ['portfolio', 'accounts', 'market', 'more'] as const;

const LIGHTNING_SETTINGS_PATHS = [
  '/lightning/activate',
  '/lightning/deactivate',
  '/lightning/set-lnurl-address',
  '/lightning/close-withdraw-funds',
];

const hasPathPrefix = (pathname: string, prefix: string): boolean => (
  pathname === prefix || pathname.startsWith(`${prefix}/`)
);

export type TBottomNavItem = typeof bottomNavKeys[number];
export type TBottomNavKey = TBottomNavItem | 'other';

/**
 * Maps a pathname to the bottom-navigation tab it belongs to.
 * Used to detect tab changes for animations and state resets.
 */
export const getBottomNavKey = (pathname: string): TBottomNavKey => {
  if (pathname.startsWith('/account-summary')) {
    return 'portfolio';
  }
  if (LIGHTNING_SETTINGS_PATHS.some(prefix => hasPathPrefix(pathname, prefix))) {
    return 'more';
  }
  if (
    pathname.startsWith('/account/')
    || pathname.startsWith('/accounts/')
    || hasPathPrefix(pathname, '/lightning')
  ) {
    return 'accounts';
  }
  if (pathname.startsWith('/market/')) {
    return 'market';
  }
  if (pathname.startsWith('/settings')) {
    return 'more';
  }
  return 'other';
};

export const getBottomNavIndex = (key: TBottomNavKey): number | undefined => {
  const index = bottomNavKeys.indexOf(key as TBottomNavItem);
  return index === -1 ? undefined : index;
};

type TShouldShowBottomNavigationArgs = {
  activeAccounts: TAccount[];
  devices: TDevices;
  hasLightningAccount: boolean;
  pathname: string;
};

export const shouldShowBottomNavigation = ({
  activeAccounts,
  devices,
  hasLightningAccount,
  pathname,
}: TShouldShowBottomNavigationArgs): boolean => {
  const deviceIDs = Object.keys(devices);
  const isBitboxBootloader = Object.values(devices).includes('bitbox02-bootloader');
  if (isBitboxBootloader) {
    return false;
  }
  if (activeAccounts.length > 0 || hasLightningAccount) {
    return true;
  }
  if (pathname === '/' || pathname === '') {
    return false;
  }
  return deviceIDs.length > 0;
};

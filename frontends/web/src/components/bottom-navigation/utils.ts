// SPDX-License-Identifier: Apache-2.0

/**
 * Maps a pathname to the bottom-navigation tab it belongs to.
 * Used to detect tab changes for animations and state resets.
 */
const LIGHTNING_SETTINGS_PATHS = [
  '/lightning/activate',
  '/lightning/deactivate',
  '/lightning/set-lnurl-address',
  '/lightning/close-withdraw-funds',
];

const hasPathPrefix = (pathname: string, prefix: string): boolean => (
  pathname === prefix || pathname.startsWith(`${prefix}/`)
);

export type TBottomNavKey = 'portfolio' | 'accounts' | 'market' | 'more' | 'other';

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

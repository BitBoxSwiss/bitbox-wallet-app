// SPDX-License-Identifier: Apache-2.0

/**
 * Maps a pathname to the bottom-navigation tab it belongs to.
 * Used to detect tab changes for animations and state resets.
 */
export const getBottomNavKey = (pathname: string): string => {
  if (pathname.startsWith('/account-summary')) {
    return 'portfolio';
  }
  if (pathname.startsWith('/account/') || pathname.startsWith('/accounts/')) {
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

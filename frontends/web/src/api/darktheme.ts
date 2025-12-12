// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';

export const setDarkTheme = (isDark: boolean): Promise<null> => {
  return apiPost('set-dark-theme', isDark);
};

export const detectDarkTheme = (): Promise<boolean> => {
  return apiGet('detect-dark-theme');
};

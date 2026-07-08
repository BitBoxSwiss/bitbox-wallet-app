// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';

type TSetDarkThemeResponse = {
  success: true;
} | {
  success: false;
  errorMessage: string;
};

export const setDarkTheme = (isDark: boolean): Promise<TSetDarkThemeResponse> => {
  return apiPost('set-dark-theme', isDark);
};

export const detectDarkTheme = (): Promise<boolean> => {
  return apiGet('detect-dark-theme');
};

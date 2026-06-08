// SPDX-License-Identifier: Apache-2.0

import { apiGet } from '@/utils/request';

export const getNativeLocale = (): Promise<string> => {
  return apiGet('native-locale');
};

export type TNumberFormat = {
  decimal: string;
  group: string;
} | null;

export const getNumberFormat = (): Promise<TNumberFormat> => {
  return apiGet('number-format');
};

// SPDX-License-Identifier: Apache-2.0

import { apiGet } from '@/utils/request';

/**
 * Describes the file that is loaded from 'https://bitbox.swiss/updates/desktop.json'.
 */
type TUpdateFile = {
  current: string;
  version: string;
  description: string;
};

export const getVersion = (): Promise<string> => {
  return apiGet('version');
};

export const getUpdate = (): Promise<TUpdateFile | null> => {
  return apiGet('update');
};

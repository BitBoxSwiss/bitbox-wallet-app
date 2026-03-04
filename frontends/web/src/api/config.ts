// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';

export type TConfig = {
  readonly backend: Readonly<Record<string, unknown>>;
  readonly frontend: Readonly<Record<string, unknown>>;
};

/**
 * Fetch current config from the backend.
 */
export const getConfig = (): Promise<Partial<TConfig>> => {
  return apiGet('config');
};

/**
 * Post a config object to the backend.
 */
export const setConfig = (config: Partial<TConfig>): Promise<void> => {
  return apiPost('config', config);
};

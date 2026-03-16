// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';

export type TConfig = {
  readonly backend: Readonly<Record<string, unknown>>;
  readonly frontend: Readonly<Record<string, unknown>>;
};

let pendingConfig: Partial<TConfig> = {};

/**
 * Fetch current config from the backend.
 */
export const getConfig = (): Promise<TConfig> => {
  return apiGet('config').then((raw?: Partial<TConfig>) => {
    const backend = (raw?.backend && typeof raw.backend === 'object'
      ? { ...raw.backend }
      : {}) as Readonly<Record<string, unknown>>;
    const frontend = (raw?.frontend && typeof raw.frontend === 'object'
      ? { ...raw.frontend }
      : {}) as Readonly<Record<string, unknown>>;
    return { backend, frontend };
  });
};

/**
 * Merge partial config with current, POST to backend, return new config.
 * Source of truth remains the backend.
 */
export const setConfig = (object: Partial<TConfig>): Promise<TConfig> => {
  return getConfig()
    .then((currentConfig) => {
      const nextConfig = {
        backend: Object.assign({}, currentConfig.backend, pendingConfig.backend, object.backend),
        frontend: Object.assign({}, currentConfig.frontend, pendingConfig.frontend, object.frontend)
      };
      pendingConfig = nextConfig;
      return apiPost('config', nextConfig)
        .then(() => {
          pendingConfig = {};
          return nextConfig as TConfig;
        });
    });
};

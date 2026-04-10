// SPDX-License-Identifier: Apache-2.0

import { getConfig as apiGetConfig, setConfig as apiSetConfig, type TConfig, type TConfigUpdate } from '@/api/config';

let pendingConfig: TConfigUpdate = {};

const normalizeConfig = (raw?: Partial<TConfig>): TConfig => {
  const backend = (raw?.backend && typeof raw.backend === 'object'
    ? { ...raw.backend }
    : {}) as TConfig['backend'];
  const frontend = (raw?.frontend && typeof raw.frontend === 'object'
    ? { ...raw.frontend }
    : {}) as TConfig['frontend'];
  return { backend, frontend };
};

/**
 * Fetch current config from the backend.
 */
export const getConfig = (): Promise<TConfig> => {
  return apiGetConfig().then(normalizeConfig);
};

/**
 * Merge partial config with current, POST to backend, return new config.
 * Returns the locally merged config object. It does not refetch the config from the backend.
 */
export const setConfig = (object: TConfigUpdate): Promise<TConfig> => {
  return getConfig()
    .then((currentConfig) => {
      const nextConfig = {
        backend: Object.assign({}, currentConfig.backend, pendingConfig.backend, object.backend),
        frontend: Object.assign({}, currentConfig.frontend, pendingConfig.frontend, object.frontend)
      } as TConfig;
      pendingConfig = nextConfig;
      return apiSetConfig(nextConfig)
        .then(() => {
          pendingConfig = {};
          return nextConfig as TConfig;
        });
    });
};

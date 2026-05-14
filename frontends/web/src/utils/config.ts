// SPDX-License-Identifier: Apache-2.0

import { getConfig as apiGetConfig, setConfig as apiSetConfig, type TConfig, type TConfigUpdate } from '@/api/config';

let pendingConfig: TConfigUpdate = {};

export const emptyBackendConfig = (): TConfig['backend'] => ({} as TConfig['backend']);

export const emptyFrontendConfig = (): TConfig['frontend'] => ({});

const normalizeConfig = (raw?: Partial<TConfig>): TConfig => ({
  backend: raw?.backend && typeof raw.backend === 'object'
    ? { ...emptyBackendConfig(), ...raw.backend }
    : emptyBackendConfig(),
  frontend: raw?.frontend && typeof raw.frontend === 'object'
    ? { ...raw.frontend }
    : emptyFrontendConfig(),
});

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
      const nextConfig: TConfig = {
        backend: Object.assign(
          {},
          currentConfig.backend,
          pendingConfig.backend,
          object.backend,
        ) as TConfig['backend'],
        frontend: Object.assign(
          {},
          currentConfig.frontend,
          pendingConfig.frontend,
          object.frontend,
        ),
      };
      pendingConfig = nextConfig;
      return apiSetConfig(nextConfig)
        .then(() => {
          pendingConfig = {};
          return nextConfig;
        });
    });
};

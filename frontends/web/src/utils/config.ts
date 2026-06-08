// SPDX-License-Identifier: Apache-2.0

import { getConfig as apiGetConfig, setConfig as apiSetConfig, type TConfig, type TConfigBackend, type TConfigFrontend } from '@/api/config';

/** Partial backend config for updates; null clears userLanguage (see i18n.ts). */
type TConfigBackendUpdate =
  Omit<Partial<TConfigBackend>, 'userLanguage'> & {
    userLanguage?: string | null;
  };

type TConfigFrontendUpdate = Partial<TConfigFrontend>;

export type TConfigUpdate = {
  backend?: TConfigBackendUpdate;
  frontend?: TConfigFrontendUpdate;
};

let pendingConfig: TConfigUpdate = {};

/**
 * Merge partial config with current, POST full TConfig to backend, return merged config.
 * Does not refetch from the backend after POST.
 */
export const setConfig = (object: TConfigUpdate): Promise<TConfig> => {
  return apiGetConfig()
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

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

let configUpdateQueue: Promise<void> = Promise.resolve();

/**
 * Serialize updates, merge with current config, POST full TConfig, and return saved config.
 * Does not refetch from the backend after POST.
 */
export const setConfig = (object: TConfigUpdate): Promise<TConfig> => {
  const update = configUpdateQueue.then(async () => {
    const currentConfig = await apiGetConfig();
    const nextConfig: TConfig = {
      backend: { ...currentConfig.backend, ...object.backend } as TConfig['backend'],
      frontend: { ...currentConfig.frontend, ...object.frontend },
    };
    const response = await apiSetConfig(nextConfig);
    if (!response.success) {
      throw new Error(response.errorMessage || 'Failed to save configuration');
    }
    return nextConfig;
  });
  configUpdateQueue = update.then(() => {}, () => {});
  return update;
};

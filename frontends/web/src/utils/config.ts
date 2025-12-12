// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';

type TConfig = {
  backend?: unknown;
  frontend?: unknown;
};

let pendingConfig: TConfig = {};

/**
 * get current configs
 * i.e. await getConfig()
 * returns a promise with backend and frontend configs
 */
export const getConfig = (): Promise<any> => {
  return apiGet('config');
};

/**
 * expects an object with a backend or frontend config
 * i.e. await setConfig({ frontend: { language }})
 * returns a promise and passes the new config
 */
export const setConfig = (object: TConfig) => {
  return getConfig()
    .then((currentConfig = {}) => {
      const nextConfig = Object.assign(currentConfig, {
        backend: Object.assign({}, currentConfig.backend, pendingConfig.backend, object.backend),
        frontend: Object.assign({}, currentConfig.frontend, pendingConfig.frontend, object.frontend)
      });
      pendingConfig = nextConfig;
      return apiPost('config', nextConfig)
        .then(() => {
          pendingConfig = {};
          return nextConfig;
        });
    });
};

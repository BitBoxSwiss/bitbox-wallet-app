// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';

export type TConfig = {
  backend?: unknown;
  frontend?: unknown;
};

export type TConfigContext = {
  getConfig: () => Promise<any>;
  setConfig: (object: TConfig) => Promise<any>;
};

export const ConfigContext = createContext<TConfigContext | undefined>(undefined);

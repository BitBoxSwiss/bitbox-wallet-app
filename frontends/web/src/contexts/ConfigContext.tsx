// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';
import type { TConfig } from '@/api/config';

export type { TConfig };

export type TConfigContext = {
  config: TConfig | undefined;
  setConfig: (object: Partial<TConfig>) => Promise<TConfig>;
};

export const ConfigContext = createContext<TConfigContext | undefined>(undefined);

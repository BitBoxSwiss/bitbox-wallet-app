// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';
import type { TConfig } from '@/api/config';
import type { TConfigUpdate } from '@/utils/config';

export type TConfigContext = {
  config: TConfig | undefined;
  setConfig: (object: TConfigUpdate) => Promise<TConfig>;
};

export const ConfigContext = createContext<TConfigContext | undefined>(undefined);

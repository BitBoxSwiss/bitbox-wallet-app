// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';
import { TLightningConfig } from '../api/lightning';

type Props = {
  lightningConfig: TLightningConfig;
};

export const LightningContext = createContext<Props>({} as Props);

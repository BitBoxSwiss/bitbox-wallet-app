// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';
import { TLightningAccount } from '@/api/lightning';

type Props = {
  lightningAccount: TLightningAccount | null;
};

export const LightningContext = createContext<Props>({} as Props);

// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';
import { TLightningAccount, TLightningConnectionStatus } from '@/api/lightning';

type Props = {
  isLightningReady: boolean | undefined;
  lightningAccount: TLightningAccount | null | undefined;
  lightningStatus: TLightningConnectionStatus | undefined;
};

export const LightningContext = createContext<Props>({} as Props);

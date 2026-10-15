// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';
import { TLightningAccount, TLightningSDKStatus } from '@/api/lightning';

type Props = {
  isLightningReady: boolean | undefined;
  lightningAccount: TLightningAccount | null | undefined;
  lightningSDKStatus: TLightningSDKStatus | undefined;
};

export const LightningContext = createContext<Props>({} as Props);

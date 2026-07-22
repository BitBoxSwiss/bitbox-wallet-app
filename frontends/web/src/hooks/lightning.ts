// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import type { TBalance } from '@/api/account';
import { getLightningBalance, subscribeLightningBalance } from '@/api/lightning';
import { useSync } from '@/hooks/api';
import { LightningContext } from '../contexts/LightningContext';

export const useLightning = () => {
  const { isLightningReady, lightningAccount } = useContext(LightningContext);
  return { isLightningReady, lightningAccount };
};

export const useLightningBalance = (): TBalance | undefined => {
  return useSync<TBalance | undefined>(
    getLightningBalance,
    subscribeLightningBalance,
  );
};

// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { LightningContext } from './LightningContext';
import { getLightningAccount, getLightningReady, subscribeLightningAccount, subscribeLightningReady } from '../api/lightning';
import { useSync } from '../hooks/api';
import { isLightningFeatureAvailable } from '@/utils/env';

type TProps = {
  children: ReactNode;
};

export const LightningProvider = ({ children }: TProps) => {
  const lightningFeatureAvailable = isLightningFeatureAvailable();
  const lightningAccount = useSync(
    lightningFeatureAvailable ? getLightningAccount : null,
    lightningFeatureAvailable ? subscribeLightningAccount : null,
  );
  const isLightningReady = useSync(
    lightningFeatureAvailable ? getLightningReady : null,
    lightningFeatureAvailable ? subscribeLightningReady : null,
  );

  return (
    <LightningContext.Provider
      value={{
        isLightningReady: lightningFeatureAvailable ? isLightningReady : false,
        lightningAccount: lightningFeatureAvailable ? lightningAccount : null,
      }}>
      {children}
    </LightningContext.Provider>
  );
};

// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { LightningContext } from './LightningContext';
import { getLightningAccount, getLightningStatus, subscribeLightningAccount, subscribeLightningStatus } from '../api/lightning';
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
  const lightningStatus = useSync(
    lightningFeatureAvailable ? getLightningStatus : null,
    lightningFeatureAvailable ? subscribeLightningStatus : null,
  );
  const isLightningReady = lightningStatus === undefined
    ? undefined
    : lightningStatus.state === 'ready';

  return (
    <LightningContext.Provider
      value={{
        isLightningReady: lightningFeatureAvailable ? isLightningReady : false,
        lightningAccount: lightningFeatureAvailable ? lightningAccount : null,
        lightningStatus: lightningFeatureAvailable ? lightningStatus : { state: 'inactive' },
      }}>
      {children}
    </LightningContext.Provider>
  );
};

// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { LightningContext } from './LightningContext';
import {
  getLightningAccount,
  getLightningSDKStatus,
  subscribeLightningAccount,
  subscribeLightningSDKStatus,
} from '../api/lightning';
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
  const sdkStatus = useSync(
    lightningFeatureAvailable ? getLightningSDKStatus : null,
    lightningFeatureAvailable ? subscribeLightningSDKStatus : null,
  );
  const lightningSDKStatus = lightningFeatureAvailable ? sdkStatus : 'inactive';
  const isLightningReady = (
    lightningSDKStatus === undefined
      ? undefined
      : lightningSDKStatus === 'ready'
  );

  return (
    <LightningContext.Provider
      value={{
        isLightningReady,
        lightningAccount: lightningFeatureAvailable ? lightningAccount : null,
        lightningSDKStatus,
      }}>
      {children}
    </LightningContext.Provider>
  );
};

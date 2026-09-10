// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useContext } from 'react';
import { LightningContext } from './LightningContext';
import { AppContext } from './AppContext';
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
  const { isTesting } = useContext(AppContext);
  const isLightningAvailable = isLightningFeatureAvailable(isTesting);
  const lightningAccount = useSync(
    isLightningAvailable ? getLightningAccount : null,
    isLightningAvailable ? subscribeLightningAccount : null,
  );
  const sdkStatus = useSync(
    isLightningAvailable ? getLightningSDKStatus : null,
    isLightningAvailable ? subscribeLightningSDKStatus : null,
  );
  const lightningSDKStatus = isLightningAvailable ? sdkStatus : 'inactive';
  const isLightningReady = (
    lightningSDKStatus === undefined
      ? undefined
      : lightningSDKStatus === 'ready'
  );

  return (
    <LightningContext.Provider
      value={{
        isLightningAvailable,
        isLightningReady,
        lightningAccount: isLightningAvailable ? lightningAccount : null,
        lightningSDKStatus,
      }}>
      {children}
    </LightningContext.Provider>
  );
};

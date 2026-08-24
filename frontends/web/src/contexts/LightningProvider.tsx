// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { LightningContext } from './LightningContext';
import { getLightningAccount, getLightningReady, subscribeLightningAccount, subscribeLightningReady } from '../api/lightning';
import { useSync } from '../hooks/api';

type TProps = {
  children: ReactNode;
};

export const LightningProvider = ({ children }: TProps) => {
  const lightningAccount = useSync(getLightningAccount, subscribeLightningAccount);
  const isLightningReady = useSync(getLightningReady, subscribeLightningReady);

  return (
    <LightningContext.Provider
      value={{
        isLightningReady,
        lightningAccount
      }}>
      {children}
    </LightningContext.Provider>
  );
};

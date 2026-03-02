// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { LightningContext } from './LightningContext';
import { getLightningConfig, subscribeLightningConfig } from '../api/lightning';
import { useSync } from '../hooks/api';
import { useDefault } from '../hooks/default';

type TProps = {
  children: ReactNode;
};

export const LightningProvider = ({ children }: TProps) => {
  const lightningConfig = useDefault(
    useSync(getLightningConfig, subscribeLightningConfig),
    { accounts: [] },
  );

  return (
    <LightningContext.Provider
      value={{
        lightningConfig
      }}>
      {children}
    </LightningContext.Provider>
  );
};

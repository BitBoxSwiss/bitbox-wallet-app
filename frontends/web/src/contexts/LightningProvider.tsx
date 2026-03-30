// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { LightningContext } from './LightningContext';
import { getLightningAccount, subscribeLightningAccount } from '../api/lightning';
import { useSync } from '../hooks/api';
import { useDefault } from '../hooks/default';

type TProps = {
  children: ReactNode;
};

export const LightningProvider = ({ children }: TProps) => {
  const lightningAccount = useDefault(
    useSync(getLightningAccount, subscribeLightningAccount),
    null,
  );

  return (
    <LightningContext.Provider
      value={{
        lightningAccount
      }}>
      {children}
    </LightningContext.Provider>
  );
};

// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useContext, useMemo } from 'react';
import { getConfig as getConfigAPI, setConfig as setConfigAPI } from '@/utils/config';
import { ConfigContext, TConfig, TConfigContext } from './ConfigContext';

type TProps = {
  children: ReactNode;
};

export const ConfigProvider = ({ children }: TProps) => {
  const value = useMemo(() => ({
    getConfig: getConfigAPI,
    setConfig: (object: TConfig) => setConfigAPI(object)
  }), []);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = (): TConfigContext => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
};

// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { getConfig, setConfig as setConfigAPI } from '@/api/config';
import { ConfigContext, TConfig, TConfigContext } from './ConfigContext';

type TProps = {
  children: ReactNode;
};

export const ConfigProvider = ({ children }: TProps) => {
  const [config, setConfigState] = useState<TConfig | undefined>(undefined);

  useEffect(() => {
    getConfig().then(setConfigState).catch(console.error);
  }, []);

  const setConfig = useCallback((object: Partial<TConfig>) => {
    return setConfigAPI(object).then(nextConfig => {
      setConfigState(nextConfig);
      return nextConfig;
    });
  }, []);

  const value: TConfigContext = {
    config,
    setConfig
  };

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

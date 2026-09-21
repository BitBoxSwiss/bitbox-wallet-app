// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useCallback, useContext, useState } from 'react';
import { getConfig } from '@/api/config';
import { setConfig as setConfigAPI } from '@/utils/config';
import type { TConfig } from '@/api/config';
import type { TConfigUpdate } from '@/utils/config';
import { ConfigContext, TConfigContext } from './ConfigContext';
import { useLoad } from '@/hooks/api';
import { useMountedRef } from '@/hooks/mount';

type TProps = {
  children: ReactNode;
};

export const ConfigProvider = ({ children }: TProps) => {
  const [savedConfig, setSavedConfig] = useState<TConfig | undefined>(undefined);
  const mounted = useMountedRef();
  const loadedConfig = useLoad(() => getConfig().catch(error => {
    console.error(error);
    return undefined;
  }));

  const setConfig = useCallback((object: TConfigUpdate) => {
    return setConfigAPI(object).then(nextConfig => {
      if (mounted.current) {
        setSavedConfig(nextConfig);
      }
      return nextConfig;
    });
  }, [mounted]);

  const value: TConfigContext = {
    config: savedConfig ?? loadedConfig,
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

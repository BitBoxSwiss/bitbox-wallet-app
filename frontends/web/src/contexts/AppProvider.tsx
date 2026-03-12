// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useEffect, useState } from 'react';
import { useConfig } from './ConfigProvider';
import { AppContext } from './AppContext';
import { useLoad } from '@/hooks/api';
import { useDefault } from '@/hooks/default';
import { getNativeLocale } from '@/api/nativelocale';
import { getDevServers, getTesting } from '@/api/backend';
import { getOnline, subscribeOnline } from '@/api/online';
import { i18nextFormat } from '@/i18n/utils';
import type { TChartDisplay } from './AppContext';
import { useOrientation } from '@/hooks/orientation';
import { useMediaQuery } from '@/hooks/mediaquery';
import { useSync } from '@/hooks/api';

type TProps = {
  children: ReactNode;
};

export const AppProvider = ({ children }: TProps) => {
  const { config, setConfig } = useConfig();
  const nativeLocale = i18nextFormat(useDefault(useLoad(getNativeLocale), 'de-CH'));
  const isTesting = useDefault(useLoad(getTesting), false);
  const isOnline = useSync(getOnline, subscribeOnline);
  const isDevServers = useDefault(useLoad(getDevServers), false);
  const [guideShown, setGuideShown] = useState(false);
  const [guideExists, setGuideExists] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState(false);
  const [chartDisplay, setChartDisplay] = useState<TChartDisplay>('all');
  const [firmwareUpdateDialogOpen, setFirmwareUpdateDialogOpen] = useState(false);

  const orientation = useOrientation();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const toggleGuide = () => {
    setConfig({ frontend: { guideShown: !guideShown } });
    setGuideShown(prev => !prev);
  };

  const toggleHideAmounts = () => {
    setConfig({ frontend: { hideAmounts: !hideAmounts } });
    setHideAmounts(prev => !prev);
  };

  const toggleSidebar = () => {
    setActiveSidebar(prev => !prev);
  };

  useEffect(() => {
    if (activeSidebar && isMobile && orientation === 'portrait') {
      setActiveSidebar(false);
    }
  }, [activeSidebar, isMobile, orientation]);

  useEffect(() => {
    const frontend = config?.frontend;
    if (frontend && typeof frontend === 'object') {
      if (frontend.guideShown !== undefined) {
        setGuideShown(Boolean(frontend.guideShown));
      }
      if (frontend.hideAmounts !== undefined) {
        setHideAmounts(Boolean(frontend.hideAmounts));
      }
    } else if (config !== undefined) {
      setGuideShown(true);
    }
  }, [config]);

  return (
    <AppContext.Provider
      value={{
        activeSidebar,
        toggleGuide,
        guideShown,
        guideExists,
        hideAmounts,
        isTesting,
        isDevServers,
        isOnline,
        nativeLocale,
        chartDisplay,
        setActiveSidebar,
        setGuideExists,
        setHideAmounts,
        setChartDisplay,
        toggleHideAmounts,
        toggleSidebar,
        setFirmwareUpdateDialogOpen,
        firmwareUpdateDialogOpen
      }}>
      {children}
    </AppContext.Provider>
  );
};


/**
 * Copyright 2023-2024 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ReactNode, useEffect, useState } from 'react';
import { getConfig, setConfig } from '@/utils/config';
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
}

export const AppProvider = ({ children }: TProps) => {
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
    getConfig().then(({ frontend }) => {
      if (frontend) {
        if (frontend.guideShown !== undefined) {
          setGuideShown(frontend.guideShown);
        }
        if (frontend.hideAmounts !== undefined) {
          setHideAmounts(frontend.hideAmounts);
        }
      } else {
        setGuideShown(true);
      }
    });
  }, []);

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


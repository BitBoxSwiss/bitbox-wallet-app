/**
 * Copyright 2025 Shift Crypto AG
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

import { ReactNode, createContext, useContext, useState } from 'react';

export type TabSection = 'portfolio' | 'accounts' | 'exchange' | 'settings';

type TabLastUrls = {
  portfolio: string;
  accounts: string;
  exchange: string;
  settings: string;
};

type TabNavigationContextType = {
  getLastUrl: (tab: TabSection) => string;
  setLastUrl: (tab: TabSection, url: string) => void;
  trackCurrentRoute: (pathname: string) => void;
};

const defaultUrls: TabLastUrls = {
  portfolio: '/account-summary',
  accounts: '/accounts/all',
  exchange: '/exchange/info',
  settings: '/settings/more',
};

const TabNavigationContext = createContext<TabNavigationContextType>({
  getLastUrl: () => '',
  setLastUrl: () => {},
  trackCurrentRoute: () => {},
});

type TabNavigationProviderProps = {
  children: ReactNode;
};

export const TabNavigationProvider = ({ children }: TabNavigationProviderProps) => {
  const [lastUrls, setLastUrls] = useState<TabLastUrls>(defaultUrls);

  const getTabFromPath = (pathname: string): TabSection | null => {
    if (pathname.startsWith('/account-summary')) {
      return 'portfolio';
    }
    if (pathname.startsWith('/account/') || pathname.startsWith('/accounts/')) {
      return 'accounts';
    }
    if (pathname.startsWith('/exchange/')) {
      return 'exchange';
    }
    if (pathname.startsWith('/settings') || pathname.startsWith('/bitsurance/')) {
      return 'settings';
    }
    return null;
  };

  const isValidTabUrl = (pathname: string): boolean => {
    if (pathname.includes('?with-chart-animation=true')) {
      return false;
    }
    return true;
  };

  const getLastUrl = (tab: TabSection): string => {
    return lastUrls[tab] || defaultUrls[tab];
  };

  const setLastUrl = (tab: TabSection, url: string): void => {
    setLastUrls(prev => ({
      ...prev,
      [tab]: url,
    }));
  };

  const trackCurrentRoute = (pathname: string): void => {
    if (!isValidTabUrl(pathname)) {
      return;
    }

    const tab = getTabFromPath(pathname);
    if (tab) {
      setLastUrl(tab, pathname);
    }
  };

  return (
    <TabNavigationContext.Provider
      value={{
        getLastUrl,
        setLastUrl,
        trackCurrentRoute,
      }}
    >
      {children}
    </TabNavigationContext.Provider>
  );
};

export const useTabNavigation = () => {
  const context = useContext(TabNavigationContext);
  if (!context) {
    throw new Error('useTabNavigation must be used within a TabNavigationProvider');
  }
  return context;
};
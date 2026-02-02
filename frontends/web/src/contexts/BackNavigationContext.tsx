// SPDX-License-Identifier: Apache-2.0

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { NavigationType, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { runningInAndroid } from '@/utils/env';

type TabId = 'portfolio' | 'accounts' | 'market' | 'settings' | 'unknown';

type BackEntry = {
  path: string;
  pathname: string;
  tabId: TabId;
};

type BackNavigationContextValue = {
  goBack: () => boolean;
  handleSystemBack: () => boolean;
};

const BackNavigationContext = createContext<BackNavigationContextValue>({
  goBack: () => false,
  handleSystemBack: () => true,
});

const getTabId = (pathname: string): TabId => {
  if (pathname.startsWith('/account-summary')) {
    return 'portfolio';
  }
  if (pathname.startsWith('/accounts/') || pathname.startsWith('/account/')) {
    return 'accounts';
  }
  if (pathname.startsWith('/add-account')) {
    return 'settings';
  }
  if (pathname.startsWith('/market/')) {
    return 'market';
  }
  if (pathname.startsWith('/manage-backups/')
    || pathname.startsWith('/settings')
    || pathname.startsWith('/bitsurance/')) {
    return 'settings';
  }
  return 'unknown';
};

const buildEntry = (pathname: string, search: string, tabId: TabId): BackEntry => ({
  path: `${pathname}${search}`,
  pathname,
  tabId,
});

const matchesAccountRoot = (pathname: string): string | null => {
  const match = pathname.match(/^\/account\/([^/]+)$/);
  return match?.[1] ?? null;
};

const matchesAccountSubroute = (pathname: string): string | null => {
  const match = pathname.match(/^\/account\/([^/]+)\/(send|receive|info|wallet-connect\/connect|wallet-connect\/dashboard)$/);
  return match?.[1] ?? null;
};

const shouldImplicitlyGoBack = (current: BackEntry, previous: BackEntry): boolean => {
  const accountRootCode = matchesAccountRoot(current.pathname);
  if (accountRootCode) {
    return previous.pathname === '/accounts/all';
  }
  const accountSubrouteCode = matchesAccountSubroute(current.pathname);
  if (accountSubrouteCode) {
    return previous.pathname === `/account/${accountSubrouteCode}`;
  }
  if (current.pathname === '/bitsurance/bitsurance') {
    return previous.pathname === '/settings/more';
  }
  return false;
};

type ProviderProps = {
  children: ReactNode;
};

export const BackNavigationProvider = ({ children }: ProviderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const stackRef = useRef<BackEntry[]>([]);
  const previousTabRef = useRef<TabId | null>(null);

  useEffect(() => {
    const tabId = getTabId(location.pathname);
    const entry = buildEntry(location.pathname, location.search, tabId);
    const previousTab = previousTabRef.current;
    const stack = stackRef.current;

    if (!previousTab || previousTab !== tabId) {
      stackRef.current = [entry];
    } else if (navigationType === NavigationType.Replace) {
      if (stack.length === 0) {
        stackRef.current = [entry];
      } else {
        stackRef.current = [...stack.slice(0, -1), entry];
      }
    } else if (navigationType === NavigationType.Pop) {
      const existingIndex = stack.findIndex(item => item.path === entry.path);
      if (existingIndex >= 0) {
        stackRef.current = stack.slice(0, existingIndex + 1);
      } else {
        stackRef.current = [entry];
      }
    } else {
      const lastEntry = stack[stack.length - 1];
      if (stack.length === 0 || lastEntry?.path !== entry.path) {
        stackRef.current = [...stack, entry];
      }
    }

    previousTabRef.current = tabId;
  }, [location.pathname, location.search, navigationType]);

  const goBack = useCallback(() => {
    const stack = stackRef.current;
    if (stack.length <= 1) {
      return false;
    }
    const previous = stack[stack.length - 2];
    stackRef.current = stack.slice(0, -1);
    navigate(previous?.path ?? '', { replace: true });
    return true;
  }, [navigate]);

  const handleSystemBack = useCallback(() => {
    const stack = stackRef.current;
    const current = stack[stack.length - 1];
    const previous = stack[stack.length - 2];
    if (current && previous && shouldImplicitlyGoBack(current, previous)) {
      goBack();
      return false;
    }
    if (runningInAndroid() && stack.length <= 1) {
      return true;
    }
    return false;
  }, [goBack]);

  const value = useMemo(() => ({
    goBack,
    handleSystemBack,
  }), [goBack, handleSystemBack]);

  return (
    <BackNavigationContext.Provider value={value}>
      {children}
    </BackNavigationContext.Provider>
  );
};

export const useBackNavigation = () => useContext(BackNavigationContext);


/* SPDX-License-Identifier: Apache-2.0 */

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useLocation } from 'wouter';
import { runningInAndroid } from '@/utils/env';
import { useNavigationType, useSearch } from '@/utils/router-compatability';

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

  if (
    pathname.startsWith('/accounts/')
    || pathname.startsWith('/account/')
  ) {
    return 'accounts';
  }

  if (pathname.startsWith('/market/')) {
    return 'market';
  }

  if (
    pathname.startsWith('/manage-backups/')
    || pathname.startsWith('/settings')
    || pathname.startsWith('/add-account')
  ) {
    return 'settings';
  }

  return 'unknown';
};

const buildEntry = (
  pathname: string,
  search: string,
  tabId: TabId,
): BackEntry => ({
  path: search ? `${pathname}?${search}` : pathname,
  pathname,
  tabId,
});

/**
 * Match exact route patterns such as:
 *   /account/:code
 *   /market/bitsurance/dashboard/:code
 *
 * Dynamic segments match one path segment only.
 */
const matchesPattern = (
  pattern: string,
  pathname: string,
): boolean => {
  const normalize = (value: string) =>
    value.length > 1 ? value.replace(/\/+$/, '') : value;

  const patternSegments = normalize(pattern).split('/');
  const pathSegments = normalize(pathname).split('/');

  if (patternSegments.length !== pathSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => {
    return segment.startsWith(':') || segment === pathSegments[index];
  });
};

type ImplicitBackRule = {
  currentPattern: string;
  previousPattern: string;
};

const accountSubroutePatterns = [
  '/account/:code/send',
  '/account/:code/receive',
  '/account/:code/info',
  '/account/:code/wallet-connect/connect',
  '/account/:code/wallet-connect/dashboard',
];

const implicitBackRules: ImplicitBackRule[] = [
  {
    currentPattern: '/account/:code',
    previousPattern: '/accounts/all',
  },

  ...accountSubroutePatterns.map((pattern) => ({
    currentPattern: pattern,
    previousPattern: '/account/:code',
  })),

  {
    currentPattern: '/market/bitsurance/:code',
    previousPattern: '/market/select/:code',
  },

  {
    currentPattern: '/market/bitsurance/dashboard/:code',
    previousPattern: '/market/select/:code',
  },
];

const matchesImplicitBackRule = (
  currentPath: string,
  previousPath: string,
  rule: ImplicitBackRule,
): boolean =>
  matchesPattern(rule.currentPattern, currentPath) &&
  matchesPattern(rule.previousPattern, previousPath);

const shouldImplicitlyGoBack = (
  current: BackEntry,
  previous: BackEntry,
): boolean =>
  implicitBackRules.some((rule) =>
    matchesImplicitBackRule(
      current.pathname,
      previous.pathname,
      rule,
    ),
  );

type ProviderProps = {
  children: ReactNode;
};

export const BackNavigationProvider = ({
  children,
}: ProviderProps) => {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const navigationType = useNavigationType();

  const stackRef = useRef<BackEntry[]>([]);
  const previousTabRef = useRef<TabId | null>(null);

  useEffect(() => {
    const pathname = location;
    const tabId = getTabId(pathname);
    const entry = buildEntry(pathname, search, tabId);

    const previousTab = previousTabRef.current;
    const stack = stackRef.current;

    // First render or switching tabs starts a fresh custom stack.
    if (!previousTab || previousTab !== tabId) {
      stackRef.current = [entry];
    } else if (navigationType === 'REPLACE') {
      // Replace the current logical history entry.
      if (stack.length === 0) {
        stackRef.current = [entry];
      } else {
        stackRef.current = [
          ...stack.slice(0, -1),
          entry,
        ];
      }
    } else if (navigationType === 'POP') {
      // Follow browser back/forward when the destination is known.
      const existingIndex = stack.findIndex(
        (item) => item.path === entry.path,
      );

      if (existingIndex >= 0) {
        stackRef.current = stack.slice(0, existingIndex + 1);
      } else {
        stackRef.current = [entry];
      }
    } else {
      // Treat an ordinary Wouter location change as a push.
      const lastEntry = stack[stack.length - 1];

      if (
        stack.length === 0 ||
        lastEntry?.path !== entry.path
      ) {
        stackRef.current = [...stack, entry];
      }
    }

    previousTabRef.current = tabId;
  }, [location, search, navigationType]);

  const goBack = useCallback((): boolean => {
    const stack = stackRef.current;

    if (stack.length <= 1) {
      return false;
    }

    const previous = stack[stack.length - 2];

    if (!previous) {
      return false;
    }

    stackRef.current = stack.slice(0, -1);

    navigate(previous.path, { replace: true });

    return true;
  }, [navigate]);

  const handleSystemBack = useCallback((): boolean => {
    const stack = stackRef.current;
    const current = stack[stack.length - 1];
    const previous = stack[stack.length - 2];

    // Apply semantic parent/child back-navigation rules.
    if (
      current &&
      previous &&
      shouldImplicitlyGoBack(current, previous)
    ) {
      goBack();
      return false;
    }

    // Let native Android handle back at the root of the custom stack.
    if (runningInAndroid() && stack.length <= 1) {
      return true;
    }

    return false;
  }, [goBack]);

  const value = useMemo(
    () => ({
      goBack,
      handleSystemBack,
    }),
    [goBack, handleSystemBack],
  );

  return (
    <BackNavigationContext.Provider value={value}>
      {children}
    </BackNavigationContext.Provider>
  );
};

export const useBackNavigation = () => useContext(BackNavigationContext);

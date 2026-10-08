// SPDX-License-Identifier: Apache-2.0

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { NavigationType, matchPath, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
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

// The app doesn't consider every URL to belong to the same navigation history.
// Instead, URLs are grouped into "tabs", and changing tabs resets the custom
// back stack.
//
// Example:
//   /account-summary -> portfolio
//   /accounts/all    -> accounts
//
// So navigating Portfolio -> Accounts doesn't make "Portfolio" a back entry
// in the Accounts stack.
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
  // `path` contains the pathname and query string used for navigation.
  // Keeping the query string here means two otherwise identical routes with
  // different query parameters are treated as distinct history entries.
  path: `${pathname}${search}`,

  // `pathname` is kept separately because implicit-back rules intentionally
  // ignore query parameters and match only the route structure.
  pathname,

  // The tab is stored with the entry so that each entry records the navigation
  // context in which it was created.
  tabId,
});

type ImplicitBackRule = {
  currentPattern: string;
  previousPattern: string;
};

// These are the account routes for which the account itself is the semantic
// parent. They are listed separately because they all share the same
// "subroute -> account" back-navigation relationship.
const accountSubroutePatterns = [
  '/account/:code/send',
  '/account/:code/receive',
  '/account/:code/info',
  '/account/:code/wallet-connect/connect',
  '/account/:code/wallet-connect/dashboard',
];

// These rules encode semantic parent/child relationships for routes where
// the desired back behavior is more specific than simply going to the
// previous browser-history location.
const implicitBackRules: ImplicitBackRule[] = [
  {
    currentPattern: '/account/:code',
    previousPattern: '/accounts/all',
  },

  // Every account subroute has the account itself as its semantic parent.
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
): boolean => {
  // `matchPath` applies React Router's route-pattern matching, including
  // dynamic parameters such as `:code`.
  //
  // For example:
  //   `/account/:code`
  //
  // matches:
  //   `/account/BTC`
  //   `/account/ETH`
  //
  // `end: true` requires the entire pathname to match the pattern. Without it,
  // a longer route such as `/account/BTC/foo` could also match `/account/:code`.
  const currentMatch = matchPath(
    { path: rule.currentPattern, end: true },
    currentPath,
  );

  // A rule only applies when the current location matches its expected
  // starting route.
  if (!currentMatch) {
    return false;
  }

  // The previous stack entry must also match the route expected by the rule.
  // This prevents a semantic back relationship from being inferred solely
  // from the current URL.
  const previousMatch = matchPath(
    { path: rule.previousPattern, end: true },
    previousPath,
  );

  if (!previousMatch) {
    return false;
  }

  return true;
};

const shouldImplicitlyGoBack = (
  current: BackEntry,
  previous: BackEntry,
): boolean => {
  // Return true when any rule matches this adjacent pair of stack entries.
  return implicitBackRules.some(rule =>
    matchesImplicitBackRule(
      current.pathname,
      previous.pathname,
      rule,
    ),
  );
};

type ProviderProps = {
  children: ReactNode;
};

export const BackNavigationProvider = ({ children }: ProviderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();

  // The custom history is deliberately stored in a ref rather than React
  // state. Mutating the navigation stack must not itself trigger a provider
  // render; changes to the URL are what drive React Router's rendering.
  const stackRef = useRef<BackEntry[]>([]);

  // Tracks the tab associated with the previously observed location.
  // Entering a different tab causes the custom stack to start over.
  const previousTabRef = useRef<TabId | null>(null);

  useEffect(() => {
    // Convert the current URL into the logical navigation entry used by the
    // custom history.
    const tabId = getTabId(location.pathname);
    const entry = buildEntry(
      location.pathname,
      location.search,
      tabId,
    );

    const previousTab = previousTabRef.current;
    const stack = stackRef.current;

    // First render OR crossing into another tab:
    //
    //   accounts -> market
    //
    // becomes:
    //
    //   [current market page]
    //
    // rather than:
    //
    //   [accounts page, current market page]
    //
    // The custom stack is scoped to the active tab, so changing tabs
    // discards the previous tab's custom history and starts a new stack.
    if (!previousTab || previousTab !== tabId) {
      stackRef.current = [entry];

    // REPLACE represents a change to the current logical history position,
    // rather than a new position in history.
    } else if (navigationType === NavigationType.Replace) {
      if (stack.length === 0) {
        // A replace can occur before the custom stack has an entry, so the
        // current location becomes its initial entry.
        stackRef.current = [entry];
      } else {
        // Preserve everything before the current position and substitute the
        // new URL for the previous last entry.
        stackRef.current = [
          ...stack.slice(0, -1),
          entry,
        ];
      }

    // POP means React Router moved to an existing browser-history location.
    //
    // Find the existing logical entry by its pathname + query string and
    // truncate everything after the first matching entry.
    //
    // When the destination exists in our custom stack, truncate everything
    // after it so our logical history follows the browser-history position.
    } else if (navigationType === NavigationType.Pop) {
      // The complete `path` is compared so query parameters participate in
      // identifying the existing history entry.
      const existingIndex = stack.findIndex(
        item => item.path === entry.path,
      );

      if (existingIndex >= 0) {
        // Keep the destination and everything before it; entries after the
        // destination are no longer ahead of the current logical position.
        stackRef.current = stack.slice(0, existingIndex + 1);
      } else {
        // The destination was not recorded in our custom stack, so there is
        // no reliable way to reconstruct the missing intermediate history.
        // Start a new stack at the destination instead of fabricating entries.
        stackRef.current = [entry];
      }

    // PUSH normally creates a new logical history position. Append the current
    // entry unless it has the same path as the current last entry.
    } else {
      const lastEntry = stack[stack.length - 1];
      if (
        stack.length === 0
        || lastEntry?.path !== entry.path
      ) {
        stackRef.current = [...stack, entry];
      }
    }

    // The current tab becomes the reference point for the next location
    // change, allowing the next effect run to detect a tab transition.
    previousTabRef.current = tabId;
  }, [
    location.pathname,
    location.search,
    navigationType,
  ]);

  const goBack = useCallback(() => {
    const stack = stackRef.current;

    // A single-entry stack represents the beginning of the custom history.
    // Returning false tells the caller that this custom navigation layer did
    // not handle the back request.
    if (stack.length <= 1) {
      return false;
    }

    // The entry immediately before the current one is the custom back target.
    const previous = stack[stack.length - 2];

    // Remove the current entry before triggering navigation so the custom stack
    // immediately reflects the intended destination. The subsequent Replace
    // navigation will reconcile the current entry with the destination.
    stackRef.current = stack.slice(0, -1);

    // Replace the browser-history entry rather than pushing a new one.
    // The custom stack has already moved back to the target, so pushing would
    // add an extra browser-history entry that does not correspond to a new
    // logical navigation position.
    navigate(previous?.path ?? '', { replace: true });

    return true;
  }, [navigate]);

  const handleSystemBack = useCallback(() => {
    const stack = stackRef.current;
    const current = stack[stack.length - 1];
    const previous = stack[stack.length - 2];

    // Some route transitions have an explicit semantic parent.
    //
    // When the current and previous custom entries form one of those known
    // relationships, consume the system-back event and navigate to the semantic
    // parent using the custom stack rather than delegating to native/browser
    // history.
    //
    // Returning false here means:
    //   "the system back action should not continue."
    if (
      current
      && previous
      && shouldImplicitlyGoBack(current, previous)
    ) {
      goBack();
      return false;
    }

    // When Android has no previous entry in the custom stack, the app lets
    // the native Android back behavior take over.
    if (runningInAndroid() && stack.length <= 1) {
      return true;
    }

    // No implicit-back rule matched and Android root handling does not apply,
    // so this handler does not consume the system-back event.
    return false;
  }, [goBack]);

  // Memoize the context value so consumers receive the same object whenever
  // the two callbacks themselves have not changed. Without this, every
  // provider render would create a new context value object and could cause
  // context consumers to re-render unnecessarily.
  const value = useMemo(() => ({
    goBack,
    handleSystemBack,
  }), [
    goBack,
    handleSystemBack,
  ]);

  return (
    <BackNavigationContext.Provider value={value}>
      {children}
    </BackNavigationContext.Provider>
  );
};

export const useBackNavigation = () => useContext(BackNavigationContext);

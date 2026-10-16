// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect } from 'react';
import { useLocation } from 'wouter';
import { AppContext } from '@/contexts/AppContext';

type Navigate = (
  to: string,
  options?: { replace?: boolean },
) => void;

let navigate: Navigate | undefined;

export const isLightningRoute = (pathname: string) => (
  /^\/lightning(?:\/|$)/.test(pathname)
);

/**
 * @deprecated preact-router like. Use `useLocation` hook if possible
 */
export const route = (to: string, replace?: boolean) => {
  navigate?.(to, { replace });
};

// This component makes route fn work, and triggers an onChange function
export const RouterWatcher = () => {
  const [location, setLocation] = useLocation();
  const { setActiveSidebar } = useContext(AppContext);

  navigate = setLocation;

  useEffect(() => {
    setActiveSidebar(false);
  }, [location, setActiveSidebar]);

  return null;
};

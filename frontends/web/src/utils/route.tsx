// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect } from 'react';
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '@/contexts/AppContext';

let navigate: NavigateFunction | undefined;

/**
 * @deprecated preact-router like. Use `useNavigate` hook if possible
 */
export const route = (route: string, replace?: boolean) => {
  navigate?.(route, { replace });
};

// This component makes route fn work, and triggers an onChange function
export const RouterWatcher = () => {
  navigate = useNavigate();
  const { setActiveSidebar } = useContext(AppContext);
  const { pathname } = useLocation();

  /**
   * Gets fired when the route changes.
   */
  useEffect(() => {
    setActiveSidebar(false);
  }, [pathname, setActiveSidebar]);

  return null;
};

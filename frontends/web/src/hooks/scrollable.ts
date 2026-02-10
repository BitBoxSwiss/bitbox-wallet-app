// SPDX-License-Identifier: Apache-2.0

import { DependencyList, RefObject, useCallback, useEffect, useState } from 'react';

/**
 * Hook to detect if an element's content is scrollable (overflows).
 * Returns true when scrollHeight > clientHeight.
 */
export const useIsScrollable = <T extends HTMLElement>(
  ref: RefObject<T | null>,
  deps: DependencyList = []
): boolean => {
  const [isScrollable, setIsScrollable] = useState(false);

  const checkScrollable = useCallback(() => {
    if (ref.current) {
      const { scrollHeight, clientHeight } = ref.current;
      setIsScrollable(scrollHeight > clientHeight);
    }
  }, [ref]);

  useEffect(() => {
    checkScrollable();
    window.addEventListener('resize', checkScrollable);
    return () => window.removeEventListener('resize', checkScrollable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkScrollable, ...deps]);

  return isScrollable;
};

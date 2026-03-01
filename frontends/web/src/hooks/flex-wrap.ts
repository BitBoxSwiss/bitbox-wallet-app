// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';

/**
 * Detects whether a flex-wrap child has wrapped to a new line
 */
export const useFlexWrap = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [isWrapped, setIsWrapped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) {
      return;
    }

    const check = () => {
      const firstChild = parent.children[0] as HTMLElement | undefined;
      if (!firstChild) {
        return;
      }
      setIsWrapped(el.offsetTop > firstChild.offsetTop);
    };

    const observer = new ResizeObserver(check);
    observer.observe(parent);
    check();

    return () => observer.disconnect();
  }, []);

  return { ref, isWrapped };
};

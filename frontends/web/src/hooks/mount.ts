// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';

/**
 * useMounted returns a boolean which is true if the component is actually mounted.
 */
export const useMountedRef = () => {
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
};

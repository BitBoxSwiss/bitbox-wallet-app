// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useMountedRef } from './mount';

/**
 * Custom hook for debouncing a value
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const mounted = useMountedRef();

  useEffect(() => {
    const handler = setTimeout(() => {
      if (mounted.current) {
        setDebouncedValue(value);
      }
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay, mounted]);

  return debouncedValue;
};

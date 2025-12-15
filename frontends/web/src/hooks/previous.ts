// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';

/**
 * usePrevious let's you access the old value before it changed inside useEffect().
 * Example:
 * const [val, setVal] = useState(...);
 * const prevVal = usePevious(val);
 * useEffect(() => {
 *   console.log('Old vs new:', prevVal, val);
 * }, [prevVal, val])
 */
export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

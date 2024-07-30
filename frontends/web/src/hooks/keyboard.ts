/**
 * Copyright 2022 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useRef } from 'react';

/**
 * gets fired on each keydown and executes the provided callback.
 */
export const useKeydown = (
  callback: (e: KeyboardEvent) => void
) => {
  // Avoid adding/removing the listener on each change of callback.
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (callbackRef.current) {
        callbackRef.current(e);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [callbackRef]);
};

/**
 * useEsc handles ESC key.
 * gets fired on ESC keydown and executes the provided callback.
 */
export const useEsc = (
  callback: () => void
) => {
  useKeydown((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      callback();
    }
  });
};

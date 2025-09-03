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

const FOCUSABLE_SELECTOR = `
  a:not(:disabled),
  button:not(:disabled),
  input:not(:disabled),
  select:not(:disabled),
  textarea:not(:disabled),
  [tabindex]:not([tabindex="-1"]):not(:disabled)
`;

/**
 * Traps focus inside the given ref when active,
 * and restores focus to the previously active element on cleanup.
 */
export const useFocusTrap = (
  ref: React.RefObject<HTMLElement>,
  active: boolean,
) => {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus trap handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!active || !ref.current || e.key !== 'Tab') {
      return;
    }
    const node = ref.current;
    const focusables = node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!focusables.length) {
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  useKeydown(handleKeyDown);

  // Manage mount/unmount lifecycle
  useEffect(() => {
    if (!active || !ref.current) {
      return;
    }

    // Save previously focused element
    previouslyFocused.current = document.activeElement as HTMLElement;

    // Autofocus first element, but only if nothing inside already has focus
    if (!ref.current.contains(document.activeElement)) {
      const firstFocusable = (
        ref.current.querySelector<HTMLElement>('[autofocus]:not(:disabled)')
        ?? ref.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      firstFocusable?.focus({ preventScroll: true });
    }

    return () => {
      // Restore focus if element is still in DOM
      if (
        previouslyFocused.current &&
        document.body.contains(previouslyFocused.current)
      ) {
        previouslyFocused.current.focus();
      }
    };
  }, [ref, active]);
};

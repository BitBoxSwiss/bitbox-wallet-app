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

import { useCallback, useEffect, useRef } from 'react';

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
  const autofocusDelay = 50;

  const previouslyFocused = useRef<HTMLElement | null>(null);
  const trapEnabled = useRef(false);
  const autofocusTimer = useRef<number | null>(null);
  const cancelledAutofocus = useRef(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!trapEnabled.current || !ref.current || e.key !== 'Tab') {
        return;
      }

      const focusables = Array.from(
        ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null); // skip hidden

      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement;

      if (e.shiftKey && current && current === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && current && current === last) {
        e.preventDefault();
        first?.focus();
      }
    },
    [ref]
  );

  useEffect(() => {
    // cleanup from previous runs
    if (autofocusTimer.current) {
      window.clearTimeout(autofocusTimer.current);
      autofocusTimer.current = null;
    }
    cancelledAutofocus.current = false;

    if (!active || !ref.current) {
      trapEnabled.current = false;
      return;
    }

    const node = ref.current;
    trapEnabled.current = true;
    previouslyFocused.current = document.activeElement as HTMLElement;

    // If focus is already inside, don't schedule autofocus.
    if (node.contains(document.activeElement)) {
      // no autofocus needed
    } else {
      // If any focus enters the dialog while we're waiting, cancel the autofocus.
      const onFocusIn = (e: FocusEvent) => {
        if (node.contains(e.target as Node)) {
          cancelledAutofocus.current = true;
          if (autofocusTimer.current) {
            window.clearTimeout(autofocusTimer.current);
            autofocusTimer.current = null;
          }
        }
      };

      document.addEventListener('focusin', onFocusIn, true);

      // Delay longer than the 20ms your Dialog uses, default 50ms.
      autofocusTimer.current = window.setTimeout(() => {
        autofocusTimer.current = null;
        if (cancelledAutofocus.current) {
          return;
        }

        // final guard: if still nothing inside has focus, focus first focusable
        if (!node.contains(document.activeElement)) {
          const firstFocusable =
            node.querySelector<HTMLElement>('[autofocus]:not(:disabled)') ??
            node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
          firstFocusable?.focus({ preventScroll: true });
        }
      }, autofocusDelay);

      // remove focusin listener when effect cleanup runs
      // (we'll remove it in the effect return)
      return () => {
        document.removeEventListener('focusin', onFocusIn, true);
      };
    }

    // If we didn't return above (i.e. no focusin listener set), continue to set up keydown below.
    // Set up keydown listener on document
    const onKeyDown = (e: KeyboardEvent) => handleKeyDown(e);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      // cleanup in-case we returned earlier (also safe)
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active, ref, autofocusDelay, handleKeyDown]);

  // global keydown listener must be attached separately too so it's always active while trapEnabled
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handleKeyDown(e);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleKeyDown]);

  // cleanup on deactivate: restore previous focus, clear timers/listeners
  useEffect(() => {
    return () => {
      trapEnabled.current = false;

      if (autofocusTimer.current) {
        window.clearTimeout(autofocusTimer.current);
        autofocusTimer.current = null;
      }

      const prev = previouslyFocused.current;
      if (prev && document.body.contains(prev)) {
        // restore focus
        prev.focus();
      }
    };
  }, []);
};

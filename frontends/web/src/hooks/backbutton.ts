// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useRef } from 'react';
import { BackButtonContext, THandler } from '@/contexts/BackButtonContext';

/**
 * The Android back button will call this handler while this hook is active.
 * The handler can perform an action and:
 * - return false to stop any further action
 * - return true for Android to perform the default back operation, which is going back in browser
 * history if possible, or prompting to quit the app.
*/
export const useBackButton = (handler: THandler) => {
  const { pushHandler, popHandler } = useContext(BackButtonContext);

  // We don't want to re-trigger the handler effect below when the handler changes, no need to
  // repeat the push/pop pair unnecessarily.
  const handlerRef = useRef<THandler>(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const handler = handlerRef.current;
    pushHandler(handler);
    return () => popHandler(handler);
  }, [handlerRef, pushHandler, popHandler]);
};

/**
 * A convenience component that makes sure useBackButton is only used when the component is rendered.
 * This avoids complicated useEffect() uses to make sure useBackButton is only active depending on
 * rendering conditions.
 * This also is useful if you want to use this hook in a component that is still class-based.
 * MUST be unmounted before any calls to `navigate()`.
 */
export const UseBackButton = ({ handler }: { handler: THandler }) => {
  useBackButton(handler);
  return null;
};

/**
 * Same as UseBackButton, but with a default handler that does nothing and disables the Android back
 * button completely.
 */
export const UseDisableBackButton = () => {
  useBackButton(() => {
    return false;
  });
  return null;
};

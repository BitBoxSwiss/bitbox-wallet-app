// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useRef } from 'react';
import { BackButtonContext, THandler } from '@/contexts/BackButtonContext';

/**
 * System back (Android back button/gesture and iOS swipe-back gesture) calls this handler
 * while this hook is active.
 * The handler can perform an action and:
 * - return false to stop any further action.
 * - return true to continue with the system back policy (implicit layered back; on Android,
 *   this may fall through to the native exit prompt when no in-app back target is allowed).
 */
export const useBackButton = (handler: THandler) => {
  const { pushHandler, popHandler } = useContext(BackButtonContext);

  // Keep the latest handler logic without changing the identity used in the stack.
  const latestHandlerRef = useRef<THandler>(handler);
  useEffect(() => {
    latestHandlerRef.current = handler;
  }, [handler]);

  // This function identity remains stable for push/pop, but always forwards to the latest handler.
  const stableHandlerRef = useRef<THandler>(() => latestHandlerRef.current());

  useEffect(() => {
    const stableHandler = stableHandlerRef.current;
    pushHandler(stableHandler);
    return () => popHandler(stableHandler);
  }, [pushHandler, popHandler]);
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

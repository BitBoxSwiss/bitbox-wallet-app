// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { TSubscriptionCallback, TUnsubscribe } from '@/api/subscribe';
import { useMountedRef } from './mount';

/**
 * useSubscribeReset is a hook to subscribe to a subscription function.
 * starts on first render, and returns undefined while there is no first response.
 * re-renders on every update.
 * An array is returned: `[value, reset]`, where value is the subscribed value and `reset()` resets
 * the value to `undefined`.
 */
export const useSubscribeReset = <T>(
  subscription: ((callback: TSubscriptionCallback<T>) => TUnsubscribe),
): [T | undefined, () => void] => {
  const [response, setResponse] = useState<T>();
  const mounted = useMountedRef();
  const subscribe = () => {
    return subscription((data) => {
      if (mounted.current) {
        setResponse(data);
      }
    });
  };
  useEffect(
    () => subscribe(),
    // empty dependencies because it's only subscribed once
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );
  return [response, () => setResponse(undefined)];
};

/**
 * useSubscribe is a hook to subscribe to a subscription function.
 * starts on first render, and returns undefined while there is no first response.
 * re-renders on every update.
 */
export const useSubscribe = <T>(
  subscription: ((callback: TSubscriptionCallback<T>) => TUnsubscribe),
): (T | undefined) => {
  const [response] = useSubscribeReset(subscription);
  return response;
};

/**
 * `useLoad` executes `apiCall` and returns its result.
 *
 * `apiCall` should be a stable callback (e.g. a callback created with
 * `useCallback` or a module-level function). Otherwise, it may be called
 * on every render, causing unnecessary requests.
 *
 * Pass `null` to disable loading.
 * Returns `undefined` while loading.
 *
 * Good:
 *   useLoad(getUpdate);
 *   useLoad(useCallback(() => getVersion(deviceID), [deviceID]));
 *
 * Bad:
 *   useLoad(() => getUpdate());
 *   useLoad(() => getVersion(deviceID));
 */
export const useLoad = <T>(
  apiCall: (() => Promise<T>) | null,
): (T | undefined) => {
  const [response, setResponse] = useState<T>();
  const mounted = useMountedRef();
  const request = useRef(0);

  useEffect(() => {
    const currentRequest = ++request.current;
    setResponse(undefined);
    if (apiCall === null) {
      return;
    }
    apiCall().then((data) => {
      if (
        currentRequest === request.current // ignore older responses
        && mounted.current // ignore response when unmounted
      ) {
        setResponse(data);
      }
    });
  }, [apiCall, mounted]);

  return response;
};

/**
 * useSync is a hook to load a promise and sync to a subscription function.
 * It is a combination of useLoad and useSubscribe.
 * gets fired on first render, and returns undefined while loading,
 * re-renders on every update.
 */
export const useSync = <T>(
  apiCall: () => Promise<T>,
  subscription: ((callback: TSubscriptionCallback<T>) => TUnsubscribe),
  getRevision?: (data: T) => number,
): (T | undefined) => {
  const [response, setResponse] = useState<T>();
  const mounted = useMountedRef();
  const onData = (data: T) => {
    if (mounted.current) {
      setResponse((current) => {
        if (
          current !== undefined
          && getRevision !== undefined
          && getRevision(current) >= getRevision(data)
        ) {
          return current;
        }
        return data;
      });
    }
  };
  useEffect(
    () => {
      apiCall().then(onData);
      return subscription(onData);
    }, // we pass no dependencies because it's only queried once
    []); // eslint-disable-line react-hooks/exhaustive-deps
  return response;
};

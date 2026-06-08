// SPDX-License-Identifier: Apache-2.0

import { DependencyList, useEffect, useState } from 'react';
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
 * useLoad is a hook to load a promise.
 * gets fired on first render, and returns undefined while loading.
 * Optionally pass a dependency array as 2nd arguemnt to control re-executing apiCall
 */
export const useLoad = <T>(
  apiCall: (() => Promise<T>) | null,
  dependencies?: DependencyList,
): (T | undefined) => {
  const [response, setResponse] = useState<T>();
  const mounted = useMountedRef();
  const load = () => {
    setResponse(undefined);
    if (apiCall === null) {
      return;
    }
    apiCall().then((data) => {
      if (mounted.current) {
        setResponse(data);
      }
    });
  };
  useEffect(
    () => load(),
    // By default no dependencies are passed to only query once
    dependencies || [] // eslint-disable-line react-hooks/exhaustive-deps
  );
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
): (T | undefined) => {
  const [response, setResponse] = useState<T>();
  const mounted = useMountedRef();
  const onData = (data: T) => {
    if (mounted.current) {
      setResponse(data);
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

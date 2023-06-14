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

import { DependencyList, useEffect, useState } from 'react';
import { TSubscriptionCallback, TUnsubscribe } from '../api/subscribe';
import { UnsubscribeList } from '../utils/subscriptions';
import { useMountedRef } from './mount';

export type TSubscriptionMap<K extends string | number | symbol, T> = {
	[key in K]: T;
};

/**
 * useSubscribe is a hook to subscribe to a subscription function multiple times, passing
 * different arguments (keys) at each subscription.
 * starts on first render, and returns a map with the latest T data avaialble for each K key.
 * It returns undefined while there is no first response.
 * Re-renders on every update, or when there is a change in the dependency list items.
 * It can be used to subscribe to the same endpoints passing e.g. different account codes.
 */
export const useSubscribeMap = <K extends string | number | symbol, T>(
  // keys is the array of arguments to be passed for each subscription.
  keys: K[],
  // subscription is the wrapping function, used to insert the key
  // in the endpoint subscription call.
  subscription: ((key: K) => ((callback: TSubscriptionCallback<T>) => TUnsubscribe)),
  // callback to be executed when a new event is detected.
  callback?: (key: K, data: T) => void,
  // depencies is DependencyList that can be used to force the subscription renewal.
  dependencies?: DependencyList,
): TSubscriptionMap<K, T> | undefined => {
  const [subscriptionsMap, setSubscriptionsMap] = useState<TSubscriptionMap<K, T>>();
  const mounted = useMountedRef();
  const subscribe = (): UnsubscribeList => {
    // for each key calls the subscription passing the key.
    return keys.map(key => {
      return subscription(key)((data) => {
        if (mounted.current) {
          // execute the callback, if defined
          if (callback) {
            callback(key, data);
          }

          // update the subscriptionMap with the latest data
          setSubscriptionsMap((prevData) => ({
            ...prevData,
            [key]: data,
          } as TSubscriptionMap<K, T>));
        }
      });
    });
  };

  useEffect(
    () => {
      const unsubscribeList: UnsubscribeList = subscribe();
      return () => {
        unsubscribeList.map(unsubscribe => unsubscribe());
      };
    },
    // By default no dependencies are passed to only query once
    dependencies || [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return subscriptionsMap;
};

/**
 * useSubscribe is a hook to subscribe to a subscription function.
 * starts on first render, and returns undefined while there is no first response.
 * re-renders on every update.
 */
export const useSubscribe = <T>(
  subscription: ((callback: TSubscriptionCallback<T>) => TUnsubscribe),
): (T | undefined) => {
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

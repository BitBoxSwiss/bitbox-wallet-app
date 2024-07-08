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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { TSubscriptionCallback } from '@/api/subscribe';
import { useSubscribe, useLoad, useSync } from './api';
import * as utils from './mount';
import { TStatus } from '@/api/coins';
import { act } from 'react';

const useMountedRefSpy = vi.spyOn(utils, 'useMountedRef');

describe('hooks for api calls', () => {
  beforeEach(() => {
    useMountedRefSpy.mockReturnValue({ current: true });
  });

  describe('useLoad', () => {
    it('should load promise and return the correct resolved value', async () => {
      const mockApiCall = vi.fn().mockImplementation(() => Promise.resolve(true));
      const { result } = renderHook(() => useLoad(mockApiCall));
      await waitFor(() => expect(result.current).toBe(true));
    });

    it('re-calls apiCall when dependencies change', async () => {
      // mock apiCall function
      const mockApiCall = vi.fn().mockImplementation(() => Promise.resolve(true));

      // initialize hook with mock apiCall function and initial dependencies
      const { result } = renderHook(() => {
        const [state, setState] = useState([3]);

        //apiCall called for the first time during render
        useLoad(() => mockApiCall(), state);
        return { setState };
      });

      act(() => result.current.setState([4]));

      // for the 3rd
      act(() => result.current.setState([5]));

      // for the 4th
      act(() => result.current.setState([6]));

      await waitFor(() => expect(mockApiCall).toHaveBeenCalledTimes(4));
    });
  });

  describe('useSubscribe', () => {
    it('should return proper value of a subscription function', () => {
      const MOCK_RETURN_STATUS: TStatus = {
        tipAtInitTime: 2408855,
        tip: 2408940,
        tipHashHex: '0000000000000015f61742c773181dd368527575a6ac02ea5ecbace8e73cc083',
        targetHeight: 2408940
      };

      const mockSubscribe = vi.fn().mockImplementation(() => (cb: TSubscriptionCallback<any>) => mockSubscribeEndpoint(cb));
      const mockSubscribeEndpoint = vi.fn().mockImplementation((cb) => cb(MOCK_RETURN_STATUS));

      const { result } = renderHook(() => useSubscribe(mockSubscribe()));

      expect(result.current).toBe(MOCK_RETURN_STATUS);
    });
  });


  describe('useSync', () => {
    it('should load promise and sync to a subscription function', async () => {
      const apiValue = 'apiValue';
      const subscriptionValue = 'subscriptionValue';
      let subscriptionCallback: TSubscriptionCallback<any> | undefined;

      //A mock api call which will return `apiValue` when resolved
      const mockApiCall = vi.fn().mockResolvedValue(apiValue);

      //A mock subscription fn, which accepts a callback
      //callback will be saved to `subscriptionCallback`
      //returns an empty fn (TUnsubscribe)
      const mockSubscription = vi.fn((callback: TSubscriptionCallback<any>) => {
        subscriptionCallback = callback;
        return () => {}; // Mocking `TUnsubscribe` (a "no-op" / "empty" fn)
      });

      //Renders the hook
      const { result } = renderHook(() => useSync(mockApiCall, mockSubscription));

      // This waits for the hook to be rendered
      // and then when the state changes the first time.
      // This ensures that the hook has completed the API call
      // and updated its internal state to be `apiValue`.
      await waitFor(() => expect(result.current).toBe(apiValue));

      await waitFor(() => expect(mockApiCall).toHaveBeenCalled());
      await waitFor(() => expect(mockSubscription).toHaveBeenCalled());

      // If `subscriptionCallback` is truthy
      // it means, subscription was invoked by the hook.
      if (subscriptionCallback) {
        // We manually simulate receiving new data
        // from the subscription fn.
        act(() => {
          subscriptionCallback && subscriptionCallback(subscriptionValue);
        });
      }

      // Finally, we wait until the hook updates its internal state
      // and returns it. The returned value should be `subscriptionValue`
      await waitFor(() => expect(result.current).toBe(subscriptionValue));
    });
  });
});

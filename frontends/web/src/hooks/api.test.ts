// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { TSubscriptionCallback } from '@/api/subscribe';
import { useSubscribe, useLoad } from './api';
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

    it('clears response when apiCall becomes null', async () => {
      const mockApiCall = vi.fn().mockImplementation(() => Promise.resolve({ canUpgrade: true }));

      const { result } = renderHook(() => {
        const [deviceID, setDeviceID] = useState('test-device');
        const [isBitBox02, setIsBitBox02] = useState(true);

        const versionInfo = useLoad(
          (isBitBox02 && deviceID) ? () => mockApiCall() : null,
          [deviceID, isBitBox02]
        );

        return { versionInfo, setDeviceID, setIsBitBox02 };
      });

      await waitFor(() => expect(result.current.versionInfo).toEqual({ canUpgrade: true }));
      expect(mockApiCall).toHaveBeenCalledTimes(1);

      act(() => result.current.setDeviceID(''));

      await waitFor(() => expect(result.current.versionInfo).toBeUndefined());
      expect(mockApiCall).toHaveBeenCalledTimes(1);
    });
  });

  describe('useSubscribe', () => {
    it('should return proper value of a subscription function', () => {
      const MOCK_RETURN_STATUS: TStatus = {
        success: true,
        status: {
          tipAtInitTime: 2408855,
          tip: 2408940,
          tipHashHex: '0000000000000015f61742c773181dd368527575a6ac02ea5ecbace8e73cc083',
          targetHeight: 2408940
        }
      };

      const mockSubscribe = vi.fn().mockImplementation(() => (cb: TSubscriptionCallback<any>) => mockSubscribeEndpoint(cb));
      const mockSubscribeEndpoint = vi.fn().mockImplementation((cb) => cb(MOCK_RETURN_STATUS));

      const { result } = renderHook(() => useSubscribe(mockSubscribe()));

      expect(result.current).toBe(MOCK_RETURN_STATUS);
    });
  });
});

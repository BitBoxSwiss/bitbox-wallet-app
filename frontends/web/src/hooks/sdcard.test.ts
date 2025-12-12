// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSDCard } from './sdcard';
import { DeviceInfo } from '@/api/bitbox01';
import * as bitbox01Apis from '@/api/bitbox01';
import * as bitbox02Apis from '@/api/bitbox02';
import * as utils from './mount';

vi.mock('@/utils/request', () => ({
  apiGet: vi.fn().mockResolvedValue(''),
}));

const useMountedRefSpy = vi.spyOn(utils, 'useMountedRef');
const checkSDCardSpy = vi.spyOn(bitbox02Apis, 'checkSDCard');
const getDeviceInfoSpy = vi.spyOn(bitbox01Apis, 'getDeviceInfo');

const { checkSDCard } = bitbox02Apis;
const { getDeviceInfo } = bitbox01Apis;

describe('useSDCard', () => {
  describe('using any valid device, should call the appropriate checking method and return proper value', () => {

    beforeEach(() => {
      useMountedRefSpy.mockReturnValue({ current: true });
    });

    it('should apply for bitbox02', async () => {
      checkSDCardSpy.mockImplementation(() => Promise.resolve(true));

      const { result } = renderHook(() => useSDCard({ '000': 'bitbox02' }));

      await waitFor(() => expect(checkSDCard).toHaveBeenCalled());
      await waitFor(() => expect(result.current).toBe(true));
    });

    it('should apply for bitbox01', async () => {
      const MOCKED_DEVICE_INFO: DeviceInfo = {
        bootlock: false,
        id: '0001',
        lock: false,
        name: 'some name',
        seeded: false,
        serial: 'anystring',
        sdcard: true,
        TFA: 'anystring',
        U2F: false,
        U2F_hijack: false,
        version: '0.1',
      };

      getDeviceInfoSpy.mockResolvedValue(MOCKED_DEVICE_INFO);

      const { result } = renderHook(() => useSDCard({ '000': 'bitbox' }));

      await waitFor(() => expect(getDeviceInfo).toHaveBeenCalled());

      await waitFor(() => expect(result.current).toBe(true));
    });

  });

});


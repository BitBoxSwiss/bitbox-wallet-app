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
import { useSDCard } from './sdcard';
import { DeviceInfo } from '../api/bitbox01';
import * as bitbox01Apis from '../api/bitbox01';
import * as bitbox02Apis from '../api/bitbox02';
import * as utils from './mount';

vi.mock('../utils/request', () => ({
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
        new_hidden_wallet: false,
        pairing: false,
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


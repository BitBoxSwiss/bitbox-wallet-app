/**
 * Copyright 2023 Shift Crypto AG
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

import { MutableRefObject } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { BrowserQRCodeReader } from '@zxing/library';
import { useQRCodeScanner } from './qrcodescanner';

const mockedQRCodeReaderInstance = () => ({
  getVideoInputDevices: jest.fn().mockResolvedValue(['camera1']),
  decodeFromInputVideoDevice: jest.fn().mockResolvedValue({
    getText: jest.fn().mockReturnValue('mockedQRValue')
  }),
  reset: jest.fn()
});


jest.mock('../components/alert/Alert', () => ({
  alertUser: jest.fn()
}));

describe('useQRCodeScanner', () => {
  it('should determine if a camera is available', async () => {
    const qrCodeReaderRef = { current: mockedQRCodeReaderInstance() } as unknown as MutableRefObject<BrowserQRCodeReader | undefined>;
    const props = {
      qrCodeReaderRef,
      activeScanQR: false,
      onChangeActiveScanQR: jest.fn(),
      parseQRResult: jest.fn()
    };

    const { result, waitForNextUpdate } = renderHook(() => useQRCodeScanner(props));

    await waitForNextUpdate();

    expect(result.current).toBe(true);
  });

  it('should process QR code scanning', async () => {
    const qrCodeReaderRef = {
      current: mockedQRCodeReaderInstance()
    } as unknown as MutableRefObject<BrowserQRCodeReader | undefined>;

    const onChangeActiveScanQR = jest.fn();
    const parseQRResult = jest.fn();

    const props = {
      qrCodeReaderRef,
      activeScanQR: true,
      onChangeActiveScanQR,
      parseQRResult
    };

    const { waitForNextUpdate } = renderHook(() => useQRCodeScanner(props));

    await waitForNextUpdate();

    expect(qrCodeReaderRef.current).not.toBeNull();
    expect(onChangeActiveScanQR).toHaveBeenCalledWith(false);
    expect(parseQRResult).toHaveBeenCalledWith('mockedQRValue');
  });
});

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
import { RefObject } from 'react';
import { act, renderHook } from '@testing-library/react-hooks';
import QrScanner from 'qr-scanner';
import { useHasCamera, useQRScanner } from './qrcodescanner';


const mockScanner = {
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(),
  destroy: jest.fn(),
  hasCamera: jest.fn(() => Promise.resolve()),
};

jest.mock('qr-scanner', () => {
  class MockedQrScanner {
    start = mockScanner.start();
    stop = mockScanner.stop();
    destroy = mockScanner.destroy();
    static hasCamera: jest.Mock<Promise<void>, []>;
  }

  MockedQrScanner.hasCamera = jest.fn(() => Promise.resolve());

  return MockedQrScanner;
});

describe('useQrCodeScanner', () => {
  it('should start and stop the scanner', () => {
    const onStart = jest.fn();
    const onResult = jest.fn();
    const onError = jest.fn();

    const videoRef = {
      current: document.createElement('video')
    } as RefObject<HTMLVideoElement>;

    const { unmount } = renderHook(() => useQRScanner(videoRef, { onStart, onResult, onError }));

    expect(mockScanner.start).toBeCalled();

    act(() => {
      unmount();
    });

    expect(mockScanner.stop).toBeCalled();
    expect(mockScanner.destroy).toBeCalled();
  });
});

describe('useHasCamera', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should set hasCamera to true if a camera is available', async () => {
    (QrScanner.hasCamera as jest.Mock).mockResolvedValue(true);
    const { result, waitForNextUpdate } = renderHook(() => useHasCamera());
    await waitForNextUpdate();
    expect(result.current).toBe(true);
  });

  it('should set hasCamera to false if a camera is not available', async () => {
    (QrScanner.hasCamera as jest.Mock).mockResolvedValue(false);
    const { result } = renderHook(() => useHasCamera());
    expect(result.current).toBe(false);
  });
});
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

import { RefObject, useEffect, useState } from 'react';
import QrScanner from 'qr-scanner';
import { useMountedRef } from './mount';

const hasSomeCamera = async (): Promise<boolean> => {
  if (!navigator.mediaDevices) {
    return false;
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.some((device) => device.kind === 'videoinput');
};

export const useHasCamera = () => {
  const [hasCamera, setHasCamera] = useState(false);
  const mounted = useMountedRef();

  useEffect(() => {
    hasSomeCamera()
      .then(result => {
        if (mounted.current) {
          setHasCamera(result);
        }
      })
      .catch(console.error);
  }, [mounted]);

  return hasCamera;
};

type TUseQRScannerOptions = {
  onStart?: () => void;
  onResult: (result: QrScanner.ScanResult) => void;
  onError: (error: any) => void;
}

export const useQRScanner = (
  videoRef: RefObject<HTMLVideoElement>, {
    onStart,
    onResult,
    onError,
  }: TUseQRScannerOptions
) => {

  useEffect(() => {
    const scanner = videoRef.current && (
      new QrScanner(
        videoRef.current,
        result => {
          scanner?.stop();
          onResult(result);
        }, {
          onDecodeError: onError,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        })
    );

    scanner?.start()
      .then(() => onStart && onStart())
      .catch(console.error);

    return () => {
      scanner?.stop();
      scanner?.destroy();
    };
  }, [videoRef, onStart, onResult, onError]);

};
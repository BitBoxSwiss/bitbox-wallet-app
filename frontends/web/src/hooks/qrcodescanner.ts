/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { RefObject, useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [initErrorMessage, setInitErrorMessage] = useState();
  const scanner = useRef<QrScanner | null>(null);

  useEffect(() => {
    if (videoRef.current && !scanner.current) {
      scanner.current = new QrScanner(
        videoRef.current,
        result => {
          scanner.current?.stop();
          onResult(result);
        }, {
          onDecodeError: err => {
            const errorString = err.toString();
            if (err && !errorString.includes('No QR code found')) {
              onError(err);
            }
          },
          highlightScanRegion: true,
          highlightCodeOutline: true,
          calculateScanRegion: (v) => {
            const videoWidth = v.videoWidth;
            const videoHeight = v.videoHeight;
            const factor = 0.5;
            const size = Math.floor(Math.min(videoWidth, videoHeight) * factor);
            return {
              x: (videoWidth - size) / 2,
              y: (videoHeight - size) / 2,
              width: size,
              height: size
            };
          }
        }
      );
    }
  });

  useEffect(() => {
    (async () => {
      try {
        await scanner.current?.start();
        if (onStart) {
          onStart();
        }
      } catch (error: any) {
        const stringifiedError = error.toString();
        const cameraNotFound = stringifiedError === 'Camera not found.';
        setInitErrorMessage(cameraNotFound ? t('send.scanQRNoCameraMessage') : stringifiedError);
      }
    })();
  }, [videoRef, onStart, onResult, onError, t]);

  useEffect(() => {
    return () => {
      scanner.current?.stop();
      scanner.current?.destroy();
      scanner.current = null;
    };
  });

  return { initErrorMessage };
};

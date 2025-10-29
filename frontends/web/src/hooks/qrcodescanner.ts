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
};

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
  // loading is set to true while the scanner is being created/started/stopped/destroyed,
  // this allows to sync across re-renders.
  const loading = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      if (!videoRef.current) {
        return;
      }

      while (loading.current) {
        await new Promise(r => setTimeout(r, 100));
      }
      try {
        loading.current = true;
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
        // Somehow, the new QrScanner may return before it is ready to be started.
        // We don't have a way to know when it is ready, but this 300ms wait seems
        // to work well enough.
        await new Promise(r => setTimeout(r, 300));
        await scanner.current?.start();
        loading.current = false;
        if (onStart) {
          onStart();
        }
      } catch (error: any) {
        const stringifiedError = error.toString();
        loading.current = false;
        const cameraNotFound = stringifiedError === 'Camera not found.';
        setInitErrorMessage(cameraNotFound ? t('send.scanQRNoCameraMessage') : stringifiedError);
        onError(error);
      }
    })();

    return () => {
      (async() => {
        while (loading.current) {
          await new Promise(r => setTimeout(r, 100));
        }
        if (scanner.current) {
          loading.current = true;
          await scanner.current?.pause(true);
          await scanner.current?.stop();
          await scanner.current?.destroy();
          scanner.current = null;
          loading.current = false;
        }
      })();
    };
  }, [videoRef, onStart, onResult, onError, t]);

  return { initErrorMessage };
};

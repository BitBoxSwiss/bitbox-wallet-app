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

import { MutableRefObject, useEffect, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/library';
import { useMountedRef } from './mount';

type TProps = {
    onError: (error: any) => void;
    qrCodeReaderRef: MutableRefObject<BrowserQRCodeReader | undefined>
    activeScanQR: boolean;
    onChangeActiveScanQR: (isActive: boolean) => void;
    parseQRResult: (result: string) => void;
    videoSourceId?: string;
}

/**
 * Hook to facilitate QR code scanning.
 * Lazily loads the QRReader library.
 * @function
**/
export const useQRCodeScanner = ({
  onError,
  qrCodeReaderRef,
  activeScanQR,
  onChangeActiveScanQR,
  parseQRResult,
  videoSourceId = 'video'
}: TProps) => {

  const [hasCamera, setHasCamera] = useState(false);

  const mounted = useMountedRef();

  useEffect(() => {
    import('../components/qrcode/qrreader')
      .then(({ BrowserQRCodeReader }) => {
        if (!qrCodeReaderRef.current) {
          qrCodeReaderRef.current = new BrowserQRCodeReader();
        }
        qrCodeReaderRef.current.getVideoInputDevices()
          .then(videoInputDevices => {
            if (mounted.current) {
              setHasCamera(videoInputDevices.length > 0);
            }
          });
      })
      .catch(console.error);

    return () => {
      if (qrCodeReaderRef.current) {
        qrCodeReaderRef.current.reset();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrCodeReaderRef]); // disable warning about mounted not in the dependency list

  useEffect(() => {
    //if activeScanQR is true and qrCodeReaderRef is available,
    // hook will try to read the QR code from the camera
    // while showing the video in the specified video element.
    if (activeScanQR && qrCodeReaderRef.current) {
      qrCodeReaderRef.current.decodeFromInputVideoDevice(undefined, videoSourceId)
        .then(result => {
          onChangeActiveScanQR(false);
          parseQRResult(result.getText());
          if (qrCodeReaderRef.current) {
            qrCodeReaderRef.current.reset(); // release camera
          }
        })
        .catch(error => {
          if (error) {
            onError(error);
          }
          onChangeActiveScanQR(false);
        });
    }
  }, [activeScanQR, onError, onChangeActiveScanQR, parseQRResult, qrCodeReaderRef, videoSourceId]);

  return hasCamera;
};

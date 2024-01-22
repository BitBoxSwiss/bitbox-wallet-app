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

import { RefObject, useEffect } from 'react';
import QrScanner from 'qr-scanner';

type TUseQRScannerOptions = {
  onStart?: () => void;
  onResult: (result: string) => void;
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
    const startScanner = async () => {
      const scanner = videoRef.current && (
        new QrScanner(
          videoRef.current,
          result => {
            scanner?.stop();
            onResult(result);
          }, onError)
      );

      try {
        await scanner?.start();
        if (onStart) {
          onStart();
        }
      } catch (error) {
        console.error(error);
      }

      return () => {
        scanner?.stop();
        scanner?.destroy();
      };
    };

    // Proxy function to get a handle on scanner.start() and ensure it is cleaned up properly
    const scannerPromise = startScanner();

    return () => {
      // Clean up scanner
      scannerPromise.then(cleanupFunc => cleanupFunc());
    };
  }, [videoRef, onStart, onResult, onError]);

};
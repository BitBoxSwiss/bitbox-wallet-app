// SPDX-License-Identifier: Apache-2.0

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { useTranslation } from 'react-i18next';
import { useQRScanRegion } from './qr-scan-region';

type TUseQRScannerOptions = {
  onStart?: () => void;
  onResult: (result: QrScanner.ScanResult) => void;
  onError: (error: any) => void;
  scanRegionRef: RefObject<HTMLDivElement>;
  stopOnResult?: boolean;
};

export const useQRScanner = (
  videoRef: RefObject<HTMLVideoElement>, {
    onStart,
    onResult,
    onError,
    scanRegionRef,
    stopOnResult = true,
  }: TUseQRScannerOptions
) => {
  const { t } = useTranslation();
  const [initErrorMessage, setInitErrorMessage] = useState<string | undefined>(undefined);
  const [hasFlash, setHasFlash] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const scanner = useRef<QrScanner | null>(null);
  const calculateScanRegion = useQRScanRegion(videoRef, scanRegionRef);

  const onStartRef = useRef(onStart);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onStartRef.current = onStart;
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    let cancelled = false;
    let qrScanner: QrScanner | undefined;
    (async () => {
      try {
        qrScanner = new QrScanner(
          video,
          result => {
            if (cancelled) {
              return;
            }
            if (stopOnResult) {
              qrScanner?.stop();
            }
            onResultRef.current(result);
          }, {
            onDecodeError: err => {
              if (!cancelled && err && !err.toString().includes('No QR code found')) {
                onErrorRef.current(err);
              }
            },
            // The component draws the scan overlay.
            highlightScanRegion: false,
            highlightCodeOutline: false,
            calculateScanRegion,
          }
        );
        scanner.current = qrScanner;
        setInitErrorMessage(undefined);
        setHasFlash(false);
        setIsFlashOn(false);
        // Allow the video to settle and any previous scanner's delayed stream
        // shutdown to finish before requesting the camera.
        await new Promise(r => setTimeout(r, 300));
        if (cancelled) {
          return;
        }
        await qrScanner.start();
        if (cancelled) {
          return;
        }
        try {
          const flash = await qrScanner.hasFlash();
          if (!cancelled) {
            setHasFlash(flash);
          }
        } catch {
          // Flash detection is optional; scanning can continue without it.
        }
        if (!cancelled) {
          onStartRef.current?.();
        }
      } catch (error: any) {
        if (cancelled) {
          return;
        }
        const stringifiedError = error.toString();
        const cameraNotFound = stringifiedError === 'Camera not found.';
        setInitErrorMessage(cameraNotFound ? t('send.scanQRNoCameraMessage') : stringifiedError);
        onErrorRef.current(error);
      }
    })();

    return () => {
      cancelled = true;
      qrScanner?.pause(true);
      qrScanner?.destroy();
      scanner.current = null;
    };
  }, [videoRef, calculateScanRegion, stopOnResult, t]);

  const toggleFlash = useCallback(async () => {
    const qrScanner = scanner.current;
    if (!qrScanner) {
      return;
    }
    try {
      await qrScanner.toggleFlash();
      if (scanner.current === qrScanner) {
        setIsFlashOn(qrScanner.isFlashOn());
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  return { initErrorMessage, hasFlash, isFlashOn, toggleFlash };
};

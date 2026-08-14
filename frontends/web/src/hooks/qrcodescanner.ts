// SPDX-License-Identifier: Apache-2.0

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { useTranslation } from 'react-i18next';

type TUseQRScannerOptions = {
  onStart?: () => void;
  onResult: (result: QrScanner.ScanResult) => void;
  onError: (error: any) => void;
  stopOnResult?: boolean;
};

export const useQRScanner = (
  videoRef: RefObject<HTMLVideoElement>, {
    onStart,
    onResult,
    onError,
    stopOnResult = true,
  }: TUseQRScannerOptions
) => {
  const { t } = useTranslation();
  const [initErrorMessage, setInitErrorMessage] = useState<string | undefined>(undefined);
  const [hasFlash, setHasFlash] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const scanner = useRef<QrScanner | null>(null);
  // loading is set to true while the scanner is being created/started/stopped/destroyed,
  // this allows to sync across re-renders.
  const loading = useRef<boolean>(false);

  const onStartRef = useRef(onStart);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onStartRef.current = onStart;
  onResultRef.current = onResult;
  onErrorRef.current = onError;

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
            if (stopOnResult) {
              scanner.current?.stop();
            }
            onResultRef.current(result);
          }, {
            onDecodeError: err => {
              const errorString = err.toString();
              if (err && !errorString.includes('No QR code found')) {
                onErrorRef.current(err);
              }
            },
            // disabled bc we draw their own scan overlay.
            highlightScanRegion: false,
            highlightCodeOutline: false,
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
        try {
          setHasFlash(await scanner.current?.hasFlash() ?? false);
        } catch {
          setHasFlash(false);
        }
        if (onStartRef.current) {
          onStartRef.current();
        }
      } catch (error: any) {
        const stringifiedError = error.toString();
        loading.current = false;
        const cameraNotFound = stringifiedError === 'Camera not found.';
        setInitErrorMessage(cameraNotFound ? t('send.scanQRNoCameraMessage') : stringifiedError);
        onErrorRef.current(error);
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
  }, [videoRef, stopOnResult, t]);

  const toggleFlash = useCallback(async () => {
    const stream = videoRef.current?.srcObject;
    if (!(stream instanceof MediaStream)) {
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) {
      return;
    }
    const nextOn = !isFlashOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: nextOn }] } as unknown as MediaTrackConstraints);
      setIsFlashOn(nextOn);
    } catch (error) {
      console.error(error);
    }
  }, [videoRef, isFlashOn]);

  return { initErrorMessage, hasFlash, isFlashOn, toggleFlash };
};

// SPDX-License-Identifier: Apache-2.0

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { useTranslation } from 'react-i18next';

type TPoint = {
  x: number;
  y: number;
};

type TCameraFacingMode = 'environment' | 'user';

type TCameraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
};

type TCameraConstraints = MediaTrackConstraintSet & {
  focusMode?: 'single-shot' | 'continuous';
  pointsOfInterest?: TPoint[];
  torch?: boolean;
};

type TSupportedCameraConstraints = MediaTrackSupportedConstraints & {
  pointsOfInterest?: boolean;
};

type TUseQRScannerOptions = {
  onStart?: () => void;
  onResult: (result: QrScanner.ScanResult) => void;
  onError: (error: unknown) => void;
  scanRegionCenterY?: number;
  stopOnResult?: boolean;
};

const getVideoTrack = (video: HTMLVideoElement | null): MediaStreamTrack | undefined => {
  const stream = video?.srcObject;
  if (!stream || typeof (stream as MediaStream).getVideoTracks !== 'function') {
    return undefined;
  }
  return (stream as MediaStream).getVideoTracks()[0];
};

const getFocusMode = (
  track: MediaStreamTrack,
): 'single-shot' | 'continuous' | undefined => {
  try {
    const capabilities = track.getCapabilities() as TCameraCapabilities;
    if (capabilities.focusMode?.includes('single-shot')) {
      return 'single-shot';
    }
    if (capabilities.focusMode?.includes('continuous')) {
      return 'continuous';
    }
  } catch {
    // Camera controls are optional; scanning still works without them.
  }
  return undefined;
};

const isUserFacing = (track: MediaStreamTrack): boolean => {
  try {
    const facingMode = track.getSettings().facingMode;
    if (facingMode) {
      return facingMode === 'user';
    }
  } catch {
    // Fall back to the device label below.
  }
  return /front|user|face/i.test(track.label);
};

const applyCameraControls = async (
  track: MediaStreamTrack,
  controls: TCameraConstraints,
): Promise<void> => {
  const constraints = { ...track.getConstraints() };
  constraints.advanced = [controls];
  await track.applyConstraints(constraints);
};

export const cameraPointFromClient = (
  video: HTMLVideoElement,
  clientPoint: TPoint,
  mirrored: boolean,
): TPoint | undefined => {
  const rect = video.getBoundingClientRect();
  if (!rect.width || !rect.height || !video.videoWidth || !video.videoHeight) {
    return undefined;
  }

  const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const croppedX = (renderedWidth - rect.width) / 2;
  const croppedY = (renderedHeight - rect.height) / 2;
  const elementX = Math.min(Math.max(clientPoint.x - rect.left, 0), rect.width);
  const elementY = Math.min(Math.max(clientPoint.y - rect.top, 0), rect.height);
  const sourceX = (elementX + croppedX) / renderedWidth;

  return {
    x: mirrored ? 1 - sourceX : sourceX,
    y: (elementY + croppedY) / renderedHeight,
  };
};

export const useQRScanner = (
  videoRef: RefObject<HTMLVideoElement>, {
    onStart,
    onResult,
    onError,
    scanRegionCenterY = 0.5,
    stopOnResult = true,
  }: TUseQRScannerOptions
) => {
  const { t } = useTranslation();
  const [initErrorMessage, setInitErrorMessage] = useState<string | undefined>(undefined);
  const [cameras, setCameras] = useState<QrScanner.Camera[]>([]);
  const [cameraFacingMode, setCameraFacingMode] = useState<TCameraFacingMode>('environment');
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [canFocus, setCanFocus] = useState(false);
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

  const refreshCameras = useCallback(async (currentScanner: QrScanner) => {
    if (scanner.current !== currentScanner) {
      return;
    }
    try {
      // Request labels because this runs after camera permission has been granted. Some
      // Chromium-based webviews only expose non-default devices at this point.
      const availableCameras = await QrScanner.listCameras(true);
      if (scanner.current !== currentScanner) {
        return;
      }
      setCameras(availableCameras);
      setSelectedCameraId(
        getVideoTrack(videoRef.current)?.getSettings().deviceId || availableCameras[0]?.id || ''
      );
    } catch {
      if (scanner.current === currentScanner) {
        setCameras([]);
      }
    }
  }, [videoRef]);

  const refreshCameraInfo = useCallback(async (currentScanner: QrScanner) => {
    if (scanner.current !== currentScanner) {
      return;
    }
    const track = getVideoTrack(videoRef.current);
    setCameraFacingMode(track && isUserFacing(track) ? 'user' : 'environment');
    setCanFocus(track ? getFocusMode(track) !== undefined : false);
    setIsFlashOn(false);
    await Promise.all([
      refreshCameras(currentScanner),
      (async () => {
        try {
          const flashAvailable = await currentScanner.hasFlash();
          if (scanner.current === currentScanner) {
            setHasFlash(flashAvailable);
          }
        } catch {
          if (scanner.current === currentScanner) {
            setHasFlash(false);
          }
        }
      })(),
    ]);
  }, [refreshCameras, videoRef]);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) {
      return;
    }
    const handleDeviceChange = () => {
      const currentScanner = scanner.current;
      if (currentScanner) {
        refreshCameras(currentScanner);
      }
    };
    mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [refreshCameras]);

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
        const currentScanner = new QrScanner(
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
            // Disabled because the BitBoxApp draws its own scan overlay.
            highlightScanRegion: false,
            highlightCodeOutline: false,
            calculateScanRegion: (video) => {
              const videoWidth = video.videoWidth;
              const videoHeight = video.videoHeight;
              const factor = 0.5;
              const size = Math.floor(Math.min(videoWidth, videoHeight) * factor);
              const y = Math.min(
                Math.max(videoHeight * scanRegionCenterY - size / 2, 0),
                videoHeight - size
              );
              return {
                x: (videoWidth - size) / 2,
                y,
                width: size,
                height: size
              };
            }
          }
        );
        scanner.current = currentScanner;
        // Somehow, the new QrScanner may return before it is ready to be started.
        // We don't have a way to know when it is ready, but this 300ms wait seems
        // to work well enough.
        await new Promise(r => setTimeout(r, 300));
        await currentScanner.start();
        loading.current = false;
        await refreshCameraInfo(currentScanner);
        if (scanner.current === currentScanner) {
          onStartRef.current?.();
        }
      } catch (error) {
        const stringifiedError = String(error);
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
          await scanner.current.pause(true);
          scanner.current.stop();
          scanner.current.destroy();
          scanner.current = null;
          loading.current = false;
        }
      })();
    };
  }, [refreshCameraInfo, scanRegionCenterY, stopOnResult, t, videoRef]);

  const switchCamera = useCallback(async (camera: string) => {
    const currentScanner = scanner.current;
    if (!currentScanner || !camera) {
      return;
    }
    setIsSwitchingCamera(true);
    try {
      await currentScanner.setCamera(camera);
      if (scanner.current === currentScanner) {
        await refreshCameraInfo(currentScanner);
      }
    } catch (error) {
      onErrorRef.current(error);
    } finally {
      if (scanner.current === currentScanner) {
        setIsSwitchingCamera(false);
      }
    }
  }, [refreshCameraInfo]);

  const toggleFlash = useCallback(async () => {
    const track = getVideoTrack(videoRef.current);
    if (!track) {
      return;
    }
    const nextOn = !isFlashOn;
    try {
      await applyCameraControls(track, { torch: nextOn });
      setIsFlashOn(nextOn);
    } catch (error) {
      onErrorRef.current(error);
    }
  }, [isFlashOn, videoRef]);

  const focusAt = useCallback(async (clientPoint: TPoint): Promise<boolean> => {
    const video = videoRef.current;
    const track = getVideoTrack(video);
    if (!video || !track) {
      return false;
    }
    const focusMode = getFocusMode(track);
    const point = cameraPointFromClient(video, clientPoint, isUserFacing(track));
    if (!focusMode || !point) {
      return false;
    }

    const supportedConstraints = navigator.mediaDevices
      .getSupportedConstraints() as TSupportedCameraConstraints;
    const controls: TCameraConstraints = {
      focusMode,
      ...(supportedConstraints.pointsOfInterest ? { pointsOfInterest: [point] } : {}),
      ...(track.getSettings().torch ? { torch: true } : {}),
    };
    try {
      await applyCameraControls(track, controls);
      return true;
    } catch (error) {
      onErrorRef.current(error);
      return false;
    }
  }, [videoRef]);

  return {
    cameraFacingMode,
    cameras,
    canFocus,
    focusAt,
    hasFlash,
    initErrorMessage,
    isFlashOn,
    isSwitchingCamera,
    selectedCameraId,
    switchCamera,
    toggleFlash,
  };
};

// SPDX-License-Identifier: Apache-2.0

import {
  ChangeEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useBackButton } from '@/hooks/backbutton';
import { useQRScanner } from '@/hooks/qrcodescanner';
import { CloseXWhite, FlashWhite, FlashYellow, SyncLight } from '@/components/icon';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { runningOnMobile } from '@/utils/env';
import { triggerHapticFeedback, triggerLongHapticFeedback } from '@/utils/transport-mobile';
import style from './scan-qr.module.css';

const ANIMATION_MS = 300;
const DEFAULT_SCAN_REGION_CENTER_Y = 0.5;
const FULLSCREEN_SCAN_REGION_CENTER_Y = 0.35;

type TRequestClose = (onClosed?: () => void) => void;
type TResetLastResult = () => void;

type TFocusIndicator = {
  id: number;
  x: number;
  y: number;
};

type TProps = {
  onResult: (result: string) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
  instruction: string;
  fullscreen?: boolean;
  guideHidden?: boolean;
  children?: ReactNode | ((requestClose: TRequestClose, resetLastResult: TResetLastResult) => ReactNode);
};

export const ScanQR = ({
  onResult,
  onClose,
  instruction,
  fullscreen,
  guideHidden = false,
  children,
}: TProps) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanRegionCenterY = (
    fullscreen
      ? FULLSCREEN_SCAN_REGION_CENTER_Y
      : DEFAULT_SCAN_REGION_CENTER_Y
  );
  const [open, setOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [focusIndicator, setFocusIndicator] = useState<TFocusIndicator | null>(null);
  const closingRef = useRef(false);
  const busyRef = useRef(false);
  const processedRef = useRef<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusIndicatorId = useRef(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => {
      cancelAnimationFrame(raf);
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
    };
  }, []);

  const requestClose = useCallback<TRequestClose>((onClosed = onClose) => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    setOpen(false);
    closeTimer.current = setTimeout(onClosed, ANIMATION_MS);
  }, [onClose]);

  useBackButton(() => {
    requestClose();
    return false;
  });

  const handleValue = useCallback(async (value: string) => {
    const text = value.trim();
    if (!text || busyRef.current || closingRef.current) {
      return;
    }
    if (text === processedRef.current) {
      return;
    }
    processedRef.current = text;
    busyRef.current = true;
    setProcessing(true);
    try {
      const accepted = await onResult(text);
      if (accepted === false) {
        busyRef.current = false;
        setProcessing(false);
        return;
      }
      triggerLongHapticFeedback();
      requestClose();
    } catch (error) {
      console.error(error);
      busyRef.current = false;
      setProcessing(false);
    }
  }, [onResult, requestClose]);

  const {
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
  } = useQRScanner(videoRef, {
    onStart: () => setCameraReady(true),
    onResult: result => handleValue(result.data),
    onError: err => console.error(err),
    scanRegionCenterY,
    stopOnResult: false,
  });

  const handleToggleFlash = () => {
    triggerHapticFeedback();
    toggleFlash();
  };

  const handleCameraChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    triggerHapticFeedback();
    await switchCamera(event.target.value);
  };

  const handleCameraToggle = async () => {
    triggerHapticFeedback();
    await switchCamera(cameraFacingMode === 'user' ? 'environment' : 'user');
  };

  const handleFocus = async (event: PointerEvent<HTMLVideoElement>) => {
    if (!canFocus || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    focusIndicatorId.current++;
    const indicator = {
      id: focusIndicatorId.current,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setFocusIndicator(indicator);
    triggerHapticFeedback();
    if (!await focusAt({ x: event.clientX, y: event.clientY })) {
      setFocusIndicator(current => current?.id === indicator.id ? null : current);
    }
  };

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      requestClose();
    }
  };

  const resetLastResult = useCallback(() => {
    processedRef.current = null;
  }, []);

  const fullscreenClass = fullscreen ? style.fullscreen || '' : '';
  const content = typeof children === 'function' ? children(requestClose, resetLastResult) : children;
  const isMobile = runningOnMobile();

  return (
    <div
      className={`${style.backdrop || ''} ${open ? style.backdropOpen || '' : ''} ${fullscreenClass}`}
      onClick={handleBackdropClick}>
      <div
        className={`${style.container || ''} ${open ? style.containerOpen || '' : ''} ${fullscreenClass}`}
        style={{ '--scan-qr-focus-top': `${scanRegionCenterY * 100}%` }}>
        {!cameraReady && !initErrorMessage && (
          <div className={style.spinnerContainer}>
            <SpinnerRingAnimated />
          </div>
        )}

        <video
          autoPlay
          className={`${style.video || ''} ${canFocus ? style.videoFocusable || '' : ''}`}
          disablePictureInPicture
          muted
          onPointerDown={handleFocus}
          playsInline
          ref={videoRef}
          poster="data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%3E%20width=%2264%22%20height=%2248%22%3C/svg%3E"
        />

        {focusIndicator && (
          <span
            key={focusIndicator.id}
            className={style.focusIndicator}
            onAnimationEnd={() => setFocusIndicator(current => (
              current?.id === focusIndicator.id ? null : current
            ))}
            style={{ left: focusIndicator.x, top: focusIndicator.y }}
          />
        )}

        <div className={style.overlay}>
          <div className={`${style.focus || ''} ${guideHidden ? style.focusHidden || '' : ''}`}>
            <span className={`${style.corner || ''} ${style.topLeft || ''}`} />
            <span className={`${style.corner || ''} ${style.topRight || ''}`} />
            <span className={`${style.corner || ''} ${style.bottomLeft || ''}`} />
            <span className={`${style.corner || ''} ${style.bottomRight || ''}`} />
            <p className={style.instruction}>{instruction}</p>
          </div>
          {content && (
            <div className={style.contentSlot}>
              {content}
            </div>
          )}
        </div>

        <button
          type="button"
          className={style.closeButton}
          onClick={() => requestClose()}
        >
          <CloseXWhite />
        </button>

        {(cameras.length > 1 || hasFlash) && (
          <div className={style.controls}>
            {cameras.length > 1 && !isMobile && (
              <select
                aria-label={t('send.scanQRSelectCamera')}
                className={style.cameraSelect}
                disabled={isSwitchingCamera}
                onChange={handleCameraChange}
                value={selectedCameraId}>
                {cameras.map(camera => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label}
                  </option>
                ))}
              </select>
            )}
            {cameras.length > 1 && isMobile && (
              <button
                aria-label={t('send.scanQRSwitchCamera')}
                disabled={isSwitchingCamera}
                onClick={handleCameraToggle}
                type="button">
                <SyncLight />
              </button>
            )}
            {hasFlash && (
              <button
                type="button"
                onClick={handleToggleFlash}
                aria-label={t('send.scanQRToggleFlash')}
                aria-pressed={isFlashOn}>
                {isFlashOn ? <FlashYellow /> : <FlashWhite />}
              </button>
            )}
          </div>
        )}

        {processing && (
          <div className={style.processingOverlay}>
            <SpinnerRingAnimated />
          </div>
        )}

        {initErrorMessage && (
          <div className={style.error}>
            <p>{initErrorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};

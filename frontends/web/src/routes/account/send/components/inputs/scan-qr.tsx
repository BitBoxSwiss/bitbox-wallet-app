// SPDX-License-Identifier: Apache-2.0

import { MouseEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQRScanner } from '@/hooks/qrcodescanner';
import { CloseXWhite, FlashWhite, FlashYellow } from '@/components/icon';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { triggerHapticFeedback, triggerLongHapticFeedback } from '@/utils/transport-mobile';
import style from './scan-qr.module.css';

const ANIMATION_MS = 300;

type TRequestClose = (onClosed?: () => void) => void;

type TProps = {
  onResult: (result: string) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
  instruction: string;
  fullscreen?: boolean;
  children?: ReactNode | ((requestClose: TRequestClose) => ReactNode);
};

export const ScanQR = ({
  onResult,
  onClose,
  instruction,
  fullscreen,
  children,
}: TProps) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const closingRef = useRef(false);
  const busyRef = useRef(false);
  const processedRef = useRef<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { initErrorMessage, hasFlash, isFlashOn, toggleFlash } = useQRScanner(videoRef, {
    onStart: () => setCameraReady(true),
    onResult: result => handleValue(result.data),
    onError: err => console.error(err),
    stopOnResult: false,
  });

  const handleToggleFlash = () => {
    triggerHapticFeedback();
    toggleFlash();
  };

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      requestClose();
    }
  };

  const fullscreenClass = fullscreen ? style.fullscreen || '' : '';
  const content = typeof children === 'function' ? children(requestClose) : children;

  return (
    <div
      className={`${style.backdrop || ''} ${open ? style.backdropOpen || '' : ''} ${fullscreenClass}`}
      onClick={handleBackdropClick}>
      <div className={`${style.container || ''} ${open ? style.containerOpen || '' : ''} ${fullscreenClass}`}>
        {!cameraReady && !initErrorMessage && (
          <div className={style.spinnerContainer}>
            <SpinnerRingAnimated />
          </div>
        )}

        <video
          className={style.video}
          ref={videoRef}
          poster="data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%3E%20width=%2264%22%20height=%2248%22%3C/svg%3E"
        />

        <div className={style.overlay}>
          <div className={style.focus}>
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
          aria-label="Close">
          <CloseXWhite />
        </button>

        {hasFlash && (
          <div className={style.controls}>
            <button
              type="button"
              onClick={handleToggleFlash}
              aria-label={t('send.scanQRToggleFlash')}
              aria-pressed={isFlashOn}>
              {isFlashOn ? <FlashYellow /> : <FlashWhite />}
            </button>
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

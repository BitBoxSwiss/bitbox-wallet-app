// SPDX-License-Identifier: Apache-2.0

import { PointerEvent, RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startNativeQR, TQRCamera, TQRGeometry } from '@/utils/native-qr';

type TOptions = {
  enabled: boolean;
  gesturesEnabled: boolean;
  previewRef: RefObject<HTMLDivElement>;
  guideRef: RefObject<HTMLDivElement>;
  onResult: (text: string) => void;
};

export const useNativeQRScanner = ({ enabled, gesturesEnabled, previewRef, guideRef, onResult }: TOptions) => {
  const { t } = useTranslation();
  const [camera, setCamera] = useState<TQRCamera>();
  const [errorCode, setErrorCode] = useState<'permissionDenied' | 'noCamera' | 'cameraUnavailable'>();
  const session = useRef<ReturnType<typeof startNativeQR>>();
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ distance: 0, zoom: 1, moved: false, x: 0, y: 0 });

  useEffect(() => {
    if (!gesturesEnabled) {
      pointers.current.clear();
    }
  }, [gesturesEnabled]);

  useEffect(() => {
    if (!enabled || !previewRef.current || !guideRef.current) {
      return;
    }
    setCamera(undefined);
    setErrorCode(undefined);
    const preview = previewRef.current;
    const guide = guideRef.current;
    const root = document.getElementById('root');
    const previousOpacity = root?.style.opacity ?? '';
    const previousInert = root?.inert ?? false;
    const html = document.documentElement;
    const activePointers = pointers.current;
    let frame = 0;
    let lastGeometry = '';
    const measure = (): TQRGeometry => {
      const p = preview.getBoundingClientRect();
      const g = guide.getBoundingClientRect();
      return {
        preview: { x: p.x / window.innerWidth, y: p.y / window.innerHeight, width: p.width / window.innerWidth, height: p.height / window.innerHeight },
        guide: { x: (g.x - p.x) / p.width, y: (g.y - p.y) / p.height, width: g.width / p.width, height: g.height / p.height },
        radius: (parseFloat(getComputedStyle(preview.parentElement!).borderRadius) || 0) / p.width,
      };
    };
    // The scanner is portaled outside the app. Keep the app's layout and state,
    // but exclude its paint and input while the native camera owns the screen.
    if (root) {
      root.style.opacity = '0';
      root.inert = true;
    }
    html.dataset.nativeQr = 'true';
    try {
      const geometry = measure();
      lastGeometry = JSON.stringify(geometry);
      session.current = startNativeQR(geometry, event => {
        switch (event.type) {
        case 'ready':
        case 'state':
          setCamera(event.camera);
          break;
        case 'result':
          onResultRef.current(event.text);
          break;
        case 'error':
          setErrorCode(event.code);
          setCamera(undefined);
          break;
        }
      });
      const update = () => {
        const geometry = measure();
        const serialized = JSON.stringify(geometry);
        if (serialized !== lastGeometry) {
          lastGeometry = serialized;
          session.current?.send({ action: 'geometry', geometry });
        }
        frame = requestAnimationFrame(update);
      };
      frame = requestAnimationFrame(update);
    } catch {
      setErrorCode('cameraUnavailable');
    }
    return () => {
      cancelAnimationFrame(frame);
      session.current?.stop();
      session.current = undefined;
      activePointers.clear();
      delete html.dataset.nativeQr;
      if (root) {
        root.style.opacity = previousOpacity;
        root.inert = previousInert;
      }
    };
  }, [enabled, previewRef, guideRef]);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesturesEnabled || !camera || errorCode) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { distance: 0, zoom: camera.zoom, moved: false, x: event.clientX, y: event.clientY };
    } else {
      gesture.current.distance = distance();
      gesture.current.zoom = camera.zoom;
      gesture.current.moved = true;
    }
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesturesEnabled || !camera || !pointers.current.has(event.pointerId)) {
      return;
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (Math.hypot(event.clientX - g.x, event.clientY - g.y) > 8) {
      g.moved = true;
    }
    if (pointers.current.size === 2 && g.distance > 0) {
      session.current?.send({ action: 'zoom', zoom: g.zoom * distance() / g.distance });
    }
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) {
      return;
    }
    if (!gesture.current.moved && event.type === 'pointerup') {
      const bounds = event.currentTarget.getBoundingClientRect();
      session.current?.send({ action: 'focus', x: (event.clientX - bounds.x) / bounds.width, y: (event.clientY - bounds.y) / bounds.height });
    }
  };

  return {
    camera,
    initErrorMessage: errorCode ? t(`send.scanQRErrors.${errorCode}`) : undefined,
    toggleFlash: () => session.current?.send({ action: 'torch', enabled: !camera?.isFlashOn }),
    stop: () => session.current?.stop(),
    gestureHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
};

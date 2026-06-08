// SPDX-License-Identifier: Apache-2.0

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

export type TVendorIframeResizeHeight = {
  containerRef: RefObject<HTMLDivElement>;
  height: number;
  iframeLoaded: boolean;
  iframeRef: RefObject<HTMLIFrameElement>;
  onIframeLoad: () => void;
};

export const useVendorIframeResizeHeight = (): TVendorIframeResizeHeight => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [height, setHeight] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const onResize = useCallback(() => {
    if (resizeTimerRef.current) {
      clearTimeout(resizeTimerRef.current);
    }
    resizeTimerRef.current = setTimeout(() => {
      if (!containerRef.current) {
        return;
      }
      setHeight(containerRef.current.offsetHeight);
    }, 200);
  }, []);

  useEffect(() => {
    onResize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
    };
  }, [onResize]);

  const onIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    onResize();
  }, [onResize]);

  return {
    containerRef,
    height,
    iframeLoaded,
    iframeRef,
    onIframeLoad,
  };
};

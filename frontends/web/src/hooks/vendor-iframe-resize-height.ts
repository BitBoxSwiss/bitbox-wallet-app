// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefCallback, RefObject } from 'react';

export type TVendorIframeResizeHeight = {
  containerRef: RefCallback<HTMLDivElement>;
  height: number;
  iframeLoaded: boolean;
  iframeRef: RefObject<HTMLIFrameElement>;
  onIframeLoad: () => void;
};

export const useVendorIframeResizeHeight = (): TVendorIframeResizeHeight => {
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    internalContainerRef.current = node;
    setContainerNode(node);
  }, []);

  const onResize = useCallback(() => {
    if (resizeTimerRef.current) {
      clearTimeout(resizeTimerRef.current);
    }
    resizeTimerRef.current = setTimeout(() => {
      if (!internalContainerRef.current) {
        return;
      }
      setHeight(internalContainerRef.current.offsetHeight);
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

  useEffect(() => {
    if (!containerNode || !('ResizeObserver' in window)) {
      return;
    }
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(containerNode);
    return () => resizeObserver.disconnect();
  }, [containerNode, onResize]);

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

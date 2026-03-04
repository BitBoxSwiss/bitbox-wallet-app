// SPDX-License-Identifier: Apache-2.0

import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

type TUseVendorIframeShellProps = {
  agreedByConfig?: boolean;
  resizeDelay?: number;
};

type TVendorIframeShell = {
  agreedTerms: boolean;
  containerRef: RefObject<HTMLDivElement>;
  height: number;
  iframeLoaded: boolean;
  iframeRef: RefObject<HTMLIFrameElement>;
  onIframeLoad: () => void;
  setAgreedTerms: Dispatch<SetStateAction<boolean>>;
};

export const useVendorIframeShell = ({
  agreedByConfig = false,
  resizeDelay = 200,
}: TUseVendorIframeShellProps = {}): TVendorIframeShell => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [height, setHeight] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(agreedByConfig);

  useEffect(() => {
    setAgreedTerms(agreedByConfig);
  }, [agreedByConfig]);

  const onResize = useCallback(() => {
    if (resizeTimerRef.current) {
      clearTimeout(resizeTimerRef.current);
    }
    resizeTimerRef.current = setTimeout(() => {
      if (!containerRef.current) {
        return;
      }
      setHeight(containerRef.current.offsetHeight);
    }, resizeDelay);
  }, [resizeDelay]);

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
    agreedTerms,
    containerRef,
    height,
    iframeLoaded,
    iframeRef,
    onIframeLoad,
    setAgreedTerms,
  };
};

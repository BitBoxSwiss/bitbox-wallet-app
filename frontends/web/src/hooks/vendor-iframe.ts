// SPDX-License-Identifier: Apache-2.0

import { Dispatch, RefObject, SetStateAction } from 'react';

import { useVendorIframeResizeHeight } from './vendor-iframe-resize-height';
import { useVendorIframeTerms } from './vendor-iframe-terms';

type TUseVendorIframeShellProps = {
  agreedByConfig?: boolean;
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

export { useVendorIframeResizeHeight } from './vendor-iframe-resize-height';
export { useVendorIframeTerms } from './vendor-iframe-terms';

export const useVendorIframeShell = ({
  agreedByConfig = false,
}: TUseVendorIframeShellProps = {}): TVendorIframeShell => {
  const { containerRef, height, iframeLoaded, iframeRef, onIframeLoad } = useVendorIframeResizeHeight();
  const { agreedTerms, setAgreedTerms } = useVendorIframeTerms(agreedByConfig);

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

// SPDX-License-Identifier: Apache-2.0

import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TDevices } from '@/api/devices';
import { GlobalBanners } from '@/components/banners';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBannersContainerContext } from './global-banners-context';
import style from '@/components/banners/global-banners.module.css';

type TProps = {
  children: ReactNode;
  devices: TDevices;
};

export const GlobalBannersProvider = ({ children, devices }: TProps) => {
  const fallbackRef = useRef<HTMLDivElement>(null);
  const [container] = useState(() => {
    const element = document.createElement('div');
    element.className = style.container || '';
    return element;
  });
  const restore = useCallback(() => {
    fallbackRef.current?.append(container);
  }, [container]);
  const contextValue = useMemo(() => ({
    element: container,
    restore,
  }), [container, restore]);

  useLayoutEffect(() => {
    if (!container.parentElement) {
      restore();
    }
  }, [container, restore]);

  return (
    <GlobalBannersContainerContext.Provider value={contextValue}>
      <div ref={fallbackRef} />
      {children}
      {createPortal(
        <ContentWrapper>
          <GlobalBanners devices={devices} />
        </ContentWrapper>,
        container,
      )}
    </GlobalBannersContainerContext.Provider>
  );
};

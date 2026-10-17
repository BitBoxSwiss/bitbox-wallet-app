// SPDX-License-Identifier: Apache-2.0

import { Children, isValidElement, ReactNode, useLayoutEffect, useRef } from 'react';
import { useGlobalBannersContainer } from '@/contexts/global-banners-context';
import { useDesktopModernized } from '@/components/desktop-chrome/desktop-chrome';
import { Header } from './header';
import style from './main.module.css';

type TMainProps = {
  children: ReactNode;
};

export const Main = ({ children }: TMainProps) => {
  const mainRef = useRef<HTMLElement>(null);
  const globalBannersContainer = useGlobalBannersContainer();
  const modernized = useDesktopModernized();
  const parts = Children.toArray(children);
  const headerIndex = modernized ? parts.findIndex(child => isValidElement(child) && child.type === Header) : -1;
  const hasCaption = headerIndex >= 0;

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main || !globalBannersContainer) {
      return;
    }
    const { element, restore } = globalBannersContainer;
    main.prepend(element);
    return () => {
      if (element.parentElement === main) {
        restore();
      }
    };
  }, [globalBannersContainer, hasCaption]);

  if (hasCaption) {
    return (
      <div className={style.desktopFrame}>
        {parts[headerIndex]}
        <main className={style.main} ref={mainRef} data-window-scroll>
          {parts.filter((_, index) => index !== headerIndex)}
        </main>
      </div>
    );
  }

  return (
    <main className={style.main} ref={mainRef}>
      {children}
    </main>
  );
};

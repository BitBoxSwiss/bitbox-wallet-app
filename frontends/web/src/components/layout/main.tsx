// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useLayoutEffect, useRef } from 'react';
import { useGlobalBannersContainer } from '@/contexts/global-banners-context';
import style from './main.module.css';

type TMainProps = {
  children: ReactNode;
};

export const Main = ({ children }: TMainProps) => {
  const mainRef = useRef<HTMLElement>(null);
  const globalBannersContainer = useGlobalBannersContainer();

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
  }, [globalBannersContainer]);

  return (
    <main className={style.main} ref={mainRef}>
      {children}
    </main>
  );
};

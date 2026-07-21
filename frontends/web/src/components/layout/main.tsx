// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import style from './main.module.css';

type TMainProps = {
  children: ReactNode;
  noHorizontalScroll?: boolean;
};

export const Main = ({
  children,
  noHorizontalScroll,
}: TMainProps) => {
  return (
    <main className={`${style.main || ''} ${noHorizontalScroll && style.noHorizontalScroll || ''}`.trim()}>
      {children}
    </main>
  );
};

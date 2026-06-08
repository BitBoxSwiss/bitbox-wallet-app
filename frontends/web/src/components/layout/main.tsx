// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import style from './main.module.css';

type TMainProps = {
  children: ReactNode;
};

export const Main = ({ children }: TMainProps) => {
  return (
    <main className={style.main}>
      {children}
    </main>
  );
};

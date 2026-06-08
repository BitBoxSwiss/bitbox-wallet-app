// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useEffect, useState } from 'react';
import style from './Toast.module.css';

type TProps = {
  theme: string;
  withGuide?: boolean;
  children: ReactNode;
};

export const Toast = ({ theme, withGuide = false, children }: TProps) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setTimeout(() => setActive(true), 5);
  }, []);

  return (
    <div
      className={[style.toast, style[theme], active ? style.active : '', withGuide ? style.shifted : ''].join(' ')}>
      <p>{children}</p>
    </div>
  );
};



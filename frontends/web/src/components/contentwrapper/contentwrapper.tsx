// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import style from './contentwrapper.module.css';

type TProps = {
  className?: string;
  children: ReactNode;
};

export const ContentWrapper = (({ className = '', children }: TProps) => {
  return (
    <div className={`
      ${className}
      ${style.contentWrapper || ''}
    `}>
      {children}
    </div>
  );
});

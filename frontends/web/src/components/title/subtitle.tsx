// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import style from './subtitle.module.css';

type Props = {
  children: ReactNode;
  className?: string;
};

export const SubTitle = ({
  className = '',
  children
}: Props) => {
  const classNames = className ? `${style.subtitle || ''} ${className}` : style.subtitle;
  return (
    <h2 className={classNames}>
      {children}
    </h2>
  );
};

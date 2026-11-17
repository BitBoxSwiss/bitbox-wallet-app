// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import style from './terms.module.css';

type TProps = {
  children: ReactNode;
  buttons?: ReactNode;
  error?: ReactNode;
  readOnly?: boolean;
};

export const TermsLayout = ({ children, buttons, error, readOnly = false }: TProps) => (
  <div className={readOnly ? style.readOnly : style.disclaimerContainer}>
    <div className={style.disclaimer}>{children}</div>
    {!readOnly && (
      <>
        {error}
        <div className={style.buttons}>{buttons}</div>
      </>
    )}
  </div>
);

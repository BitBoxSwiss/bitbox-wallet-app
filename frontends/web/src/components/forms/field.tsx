// SPDX-License-Identifier: Apache-2.0

import style from './field.module.css';

export const Field = ({
  children, ...props
}: JSX.IntrinsicElements['div']) => {
  return (
    <div className={style.field} {...props}>
      {children}
    </div>
  );
};

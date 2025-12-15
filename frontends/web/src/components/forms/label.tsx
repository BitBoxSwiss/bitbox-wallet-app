// SPDX-License-Identifier: Apache-2.0

import style from './label.module.css';

export const Label = ({
  className,
  children,
  id, // TODO: change to htmlFor when mirgated away from preact@8.x
  ...props
}: JSX.IntrinsicElements['label']) => {
  const classes = [style.label, className].join(' ');
  return (
    <label htmlFor={id} className={classes} {...props}>
      {children}
    </label>
  );
};

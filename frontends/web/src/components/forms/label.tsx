// SPDX-License-Identifier: Apache-2.0

import style from './label.module.css';

export const Label = ({
  className,
  children,
  ...props
}: JSX.IntrinsicElements['label']) => {
  const classes = [style.label, className].join(' ');
  return (
    <label className={classes} {...props}>
      {children}
    </label>
  );
};

// SPDX-License-Identifier: Apache-2.0

import style from './skeleton.module.css';

type TProps = {
  className?: string;
  fontSize?: string;
  minWidth?: string;

};

export const Skeleton = ({
  className = '',
  fontSize,
  minWidth = '100%',
}: TProps) => {
  return (
    <span
      className={`${style.skeleton || ''} ${className}`}
      style={{ fontSize, minWidth }}
    />
  );
};

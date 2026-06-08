// SPDX-License-Identifier: Apache-2.0

import { ReactElement, ReactNode } from 'react';
import style from './badge.module.css';

type TBadgeStyles = 'success' | 'warning' | 'danger' | 'info';

type TProps = {
  children?: ReactNode;
  type?: TBadgeStyles;
  icon?: (props: { className: string }) => ReactElement;
} & JSX.IntrinsicElements['span'];

export const Badge = ({
  children,
  className,
  icon,
  type = 'success',
  ...props
}: TProps) => {
  const withChildrenStyle = children !== undefined ? style.withChildren : '';
  const iconOnlyStyle = (children === undefined && icon) ? style.iconOnly : '';
  return (
    <span
      className={`
        ${style.badge || ''}
        ${style[type] || ''}
        ${withChildrenStyle || ''}
        ${iconOnlyStyle || ''}
        ${className || ''}
      `}
      {...props}>
      {icon && style.badgeIcon && icon({
        className: style.badgeIcon || ''
      })}
      {children}
    </span>
  );
};

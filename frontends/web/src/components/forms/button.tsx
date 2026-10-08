// SPDX-License-Identifier: Apache-2.0

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Link } from 'wouter';
import style from './button.module.css';

type TButtonStyleProp =
  ({ danger: true } & Omit<TButtonStyleBase, 'danger'>)
  | ({ primary: true } & Omit<TButtonStyleBase, 'primary'>)
  | ({ secondary: true } & Omit<TButtonStyleBase, 'secondary'>)
  | ({ transparent: true } & Omit<TButtonStyleBase, 'transparent'>);

type TButtonStyleBase = {
  danger?: false;
  primary?: false;
  secondary?: false;
  transparent?: false;
};

type TProps = TButtonStyleProp & {
  disabled?: boolean;
  children: ReactNode;
  inline?: boolean;
};

type TButtonLink = TProps & {
  className?: string;
  to: string;
  onClick?: ComponentPropsWithoutRef<typeof Link>['onClick'];
};

export const ButtonLink = ({
  primary,
  secondary,
  transparent,
  danger,
  className = '',
  children,
  disabled,
  inline,
  to,
  ...props
}: TButtonLink) => {
  const classNames = `
    ${style[
      (primary && 'primary')
      || (secondary && 'secondary')
      || (transparent && 'transparent')
      || (danger && 'danger')
      || 'button'
    ] || ''}
    ${inline && style.inline || ''}
    ${className || ''}
  `.trim();

  if (disabled) {
    return (
      <button
        className={classNames}
        disabled>
        {children}
      </button>
    );
  }
  return (
    <Link
      to={to}
      className={classNames}
      {...props}>
      {children}
    </Link>
  );
};

type TButton = TProps & ComponentPropsWithoutRef<'button'>;

export const Button = ({
  type = 'button',
  primary,
  secondary,
  transparent,
  danger,
  className = '',
  children,
  inline,
  ...props
}: TButton) => {
  const classNames = `
    ${style[
      (primary && 'primary')
      || (secondary && 'secondary')
      || (transparent && 'transparent')
      || (danger && 'danger')
      || 'button'
    ] || ''}
    ${inline && style.inline || ''}
    ${className || ''}
  `.trim();

  return (
    <button
      type={type}
      className={classNames}
      {...props}>
      {children}
    </button>
  );
};

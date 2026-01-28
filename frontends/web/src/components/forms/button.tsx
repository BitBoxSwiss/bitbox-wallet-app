// SPDX-License-Identifier: Apache-2.0

import { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Link, LinkProps } from 'react-router-dom';
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

type TButtonLink = LinkProps & TProps;

export const ButtonLink = ({
  primary,
  secondary,
  transparent,
  danger,
  className = '',
  children,
  disabled,
  inline,
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

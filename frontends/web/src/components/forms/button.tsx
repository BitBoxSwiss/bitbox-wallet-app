/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Link, LinkProps } from 'react-router-dom';
import style from './button.module.css';

type TProps = {
    danger?: boolean;
    disabled?: boolean;
    primary?: boolean;
    secondary?: boolean;
    transparent?: boolean;
    children: ReactNode;
}

export const ButtonLink = ({
  primary = false,
  secondary = false,
  transparent = false,
  danger = false,
  className = '',
  children,
  disabled,
  ...props
}: TProps & LinkProps) => {
  const classNames = [
    style[
      (primary && 'primary')
            || (secondary && 'secondary')
            || (transparent && 'transparent')
            || (danger && 'danger')
            || 'button'
    ], className
  ].join(' ');

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

export const Button = ({
  type = 'button',
  primary = false,
  secondary = false,
  transparent = false,
  danger = false,
  className = '',
  children,
  ...props
}: TProps & ComponentPropsWithoutRef<'button'>) => {
  const classNames = [
    style[(primary && 'primary')
            || (secondary && 'secondary')
            || (transparent && 'transparent')
            || (danger && 'danger')
            || 'button'
    ], className
  ].join(' ');

  return (
    <button
      type={type}
      className={classNames}
      {...props}>
      {children}
    </button>
  );
};

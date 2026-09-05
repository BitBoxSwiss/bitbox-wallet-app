// SPDX-License-Identifier: Apache-2.0

import type { ComponentProps } from 'react';
import { ButtonLink } from '@/components/forms';
import style from '@/routes/account/account.module.css';

type TProps = Omit<
  ComponentProps<typeof ButtonLink>,
  'className' | 'danger' | 'primary' | 'secondary' | 'transparent'
> & {
  className?: string;
};

export const AccountActionButtonLink = ({
  className = '',
  disabled,
  onClick,
  ...props
}: TProps) => (
  <ButtonLink
    className={`
      ${style.button || ''}
      ${disabled && style.disabled || ''}
      ${className || ''}
    `.trim()}
    primary
    {...props}
  />
);

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
  ...props
}: TProps) => (
  <ButtonLink
    className={`${style.button || ''} ${className || ''}`.trim()}
    primary
    {...props}
  />
);

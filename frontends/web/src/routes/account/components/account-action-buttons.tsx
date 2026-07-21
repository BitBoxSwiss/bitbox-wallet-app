// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import style from '@/routes/account/account.module.css';

type TProps = {
  children: ReactNode;
  // compact makes the buttons hug their labels (instead of stretching to equal
  // widths) and scales the label size and horizontal padding fluidly with the
  // available width. Used on the Lightning screen.
  compact?: boolean;
  withWalletConnect?: boolean;
};

export const AccountActionButtons = ({
  children,
  compact,
  withWalletConnect,
}: TProps) => (
  <div className={`
    ${style.actionsContainer || ''}
    ${compact && style.compact || ''}
    ${withWalletConnect && style.withWalletConnect || ''}
  `}>
    {children}
  </div>
);

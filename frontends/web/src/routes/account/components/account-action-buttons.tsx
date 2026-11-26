// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import style from './account-action-buttons.module.css';

type TProps = {
  children: ReactNode;
  withWalletConnect?: boolean;
};

export const AccountActionButtons = ({
  children,
  withWalletConnect,
}: TProps) => (
  <div className={`
    ${style.actionsContainer || ''}
    ${withWalletConnect && style.withWalletConnect || ''}
  `}>
    {children}
  </div>
);

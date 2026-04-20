// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { CoinCode } from '@/api/account';
import { Logo } from '@/components/icon/logo';
import style from './token-list-item.module.css';

type TokenListItemProps = {
  children: ReactNode;
  active?: boolean;
  className?: string;
  coinCode: CoinCode;
  lineColor?: string;
  name: string;
  onClick?: () => void;
};

export const TokenListItem = ({
  children,
  active = true,
  className,
  coinCode,
  lineColor,
  name,
  onClick,
}: TokenListItemProps) => {
  const isClickable = active && onClick !== undefined;
  return (
    <div
      className={`
        ${style.token || ''}
        ${!active ? style.tokenInactive || '' : ''}
        ${isClickable ? style.accountActive || '' : ''}
        ${className || ''}
      `}
      style={lineColor ? { '--token-line-color': lineColor } : undefined}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className={style.accountLink || ''}>
        <Logo
          active={active}
          alt={name}
          className={style.tokenIcon}
          coinCode={coinCode}
          stacked />
        <span className={style.tokenName} data-testid="account-name">
          {name}
        </span>
      </div>
      {children}
    </div>
  );
};

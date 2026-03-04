// SPDX-License-Identifier: Apache-2.0

import React, { ReactNode } from 'react';
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
  return (
    <div
      className={`
        ${style.token || ''}
        ${!active ? style.tokenInactive || '' : ''}
        ${className || ''}
      `}
      style={lineColor ? { '--token-line-color': lineColor } as React.CSSProperties : undefined}>
      <div
        className={`
          ${style.accountLink || ''}
          ${active ? style.accountActive || '' : ''}
        `}
        onClick={onClick}>
        <Logo
          active={active}
          alt={name}
          className={style.tokenIcon}
          coinCode={coinCode}
          stacked />
        <span className={style.tokenName}>
          {name}
        </span>
      </div>
      {children}
    </div>
  );
};

// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import type { ConversionUnit } from '@/api/account';
import { Amount } from '@/components/amount/amount';
import { Skeleton } from '@/components/skeleton/skeleton';
import style from './accountssummary.module.css';

type TProps = {
  name: ReactNode;
  hideHeader?: boolean;
  totalAmount?: string;
  fiatUnit?: ConversionUnit;
  children: ReactNode;
};

export const BalanceSection = ({ name, hideHeader, totalAmount, fiatUnit, children }: TProps) => (
  <div className={style.keystoreContainer}>
    {!hideHeader && (
      <div className={style.keystoreHeader}>
        {name}
        {totalAmount && fiatUnit ? (
          <div className={style.keystoreBalanceAmount}>
            <Amount amount={totalAmount} unit={fiatUnit} />
            <span className={style.coinUnit}>
              {fiatUnit}
            </span>
          </div>
        ) : (<div className={style.keystoreBalanceAmount}><Skeleton minWidth="60px" /></div>)}
      </div>
    )}
    <div className={style.coinGroupList}>
      {children}
    </div>
  </div>
);

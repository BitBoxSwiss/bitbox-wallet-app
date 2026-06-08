// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { CoinCode, TAmountWithConversions } from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Logo } from '@/components/icon/logo';
import { Skeleton } from '@/components/skeleton/skeleton';
import style from './accountssummary.module.css';

type Props = {
  amount?: TAmountWithConversions;
  coinCode: CoinCode;
  coinName: ReactNode;
  dataTestId?: string;
};

export const AssetBalance = ({ amount, coinCode, coinName, dataTestId }: Props) => {
  return (
    <div className={style.assetBalanceRow}>
      <div className={style.assetBalanceInfo}>
        <Logo coinCode={coinCode} active={true} alt={coinCode} />
        <div className={style.assetBalanceNameCol}>
          <span className={style.assetBalanceName} data-testid={dataTestId}>{coinName}</span>
        </div>
      </div>
      <div className={style.assetBalanceAmounts}>
        {amount ? (
          <>
            <AmountWithUnit maxDecimals={9} amount={amount}/>
            <AmountWithUnit amount={amount} convertToFiat/>
          </>
        ) : (
          <>
            <Skeleton minWidth="60px" />
            <Skeleton minWidth="40px" />
          </>
        )}
      </div>
    </div>
  );
};

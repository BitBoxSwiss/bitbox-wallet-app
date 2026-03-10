// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { CoinCode, TAmountWithConversions } from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Logo } from '@/components/icon/logo';
import { Skeleton } from '@/components/skeleton/skeleton';
import { useCoinUnitPrice } from '@/hooks/coin-unit-price';
import style from './accountssummary.module.css';

type Props = {
  amount?: TAmountWithConversions;
  coinCode: CoinCode;
  coinName: ReactNode;
  dataTestId?: string;
};

export const AssetBalanceWithUnitPrice = ({ amount, coinCode, coinName, dataTestId }: Props) => {
  const unitPrice = useCoinUnitPrice(coinCode, amount?.unit);
  return (
    <div className={style.assetBalanceRow}>
      <div className={style.assetBalanceInfoFull}>
        <Logo coinCode={coinCode} active={true} alt={coinCode} />
        <div className={style.assetBalanceDetailsCol}>
          <div className={style.assetBalanceDetailRow}>
            <span
              className={`${style.assetBalanceName || ''}
             ${style.assetBalanceNameFlex || ''}`}
              data-testid={dataTestId}
            >
              {coinName}
            </span>
            {amount ? (
              <span className={style.assetBalanceAmountFixed}>
                <AmountWithUnit amount={amount} />
              </span>
            ) : (
              <Skeleton minWidth="60px" />
            )}
          </div>
          <div className={style.assetBalanceDetailRow}>
            <AmountWithUnit
              amountClassName={style.unitPrice}
              amount={unitPrice}
              convertToFiat
            />
            {amount ? (
              <span className={style.assetBalanceAmountFixed}>
                <AmountWithUnit amount={amount} convertToFiat/>
              </span>
            ) : (
              <Skeleton minWidth="60px" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

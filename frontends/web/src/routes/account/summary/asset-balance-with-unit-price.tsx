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
        <div className={style.assetBalanceDetailsRow}>
          <div className={style.assetBalanceDetailsCol}>
            <span
              className={`${style.assetBalanceName || ''}
             ${style.assetBalanceNameFlex || ''}`}
              data-testid={dataTestId}
            >
              {coinName}
            </span>

            <div data-testid="unit-price-amount">
              <AmountWithUnit
                alwaysShowAmounts
                amountClassName={style.unitPrice}
                amount={unitPrice}
                convertToFiat
              />
              {amount?.unit && (
                <span className={style.pairUnit}>/{amount.unit}</span>
              )}
            </div>
          </div>
          <div className={style.assetBalanceAmounts}>
            {amount ? (
              <span className={style.assetBalanceAmountFixed}>
                <AmountWithUnit maxDecimals={9} amount={amount} />
              </span>
            ) : (
              <Skeleton minWidth="60px" />
            )}
            {amount ? (
              <span className={style.assetBalanceAmountFixed} data-testid="fiat-balance">
                <AmountWithUnit amount={amount} convertToFiat />
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

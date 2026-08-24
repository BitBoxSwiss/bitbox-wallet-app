// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useContext } from 'react';
import { CoinCode, TAmountWithConversions } from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Logo } from '@/components/icon/logo';
import { Skeleton } from '@/components/skeleton/skeleton';
import { RatesContext } from '@/contexts/RatesContext';
import { useCoinUnitPrice } from '@/hooks/coin-unit-price';
import { isBitcoinOnly } from '@/routes/account/utils';
import style from './accountssummary.module.css';

type TProps = {
  amount?: TAmountWithConversions;
  coinCode: CoinCode;
  coinName: ReactNode;
  dataTestId?: string;
  showUnitPrice?: boolean;
};

export const AssetBalanceWithUnitPrice = ({
  amount,
  coinCode,
  coinName,
  dataTestId,
  showUnitPrice = true,
}: TProps) => {
  const { defaultCurrency } = useContext(RatesContext);
  const unitPrice = useCoinUnitPrice(coinCode, amount?.unit);
  const shouldShowUnitPrice = showUnitPrice
    && (!isBitcoinOnly(coinCode) || (defaultCurrency !== 'BTC' && defaultCurrency !== 'sat'));

  return (
    <div className={style.assetBalanceRow}>
      <div className={style.assetBalanceInfoFull}>
        <Logo className={style.assetBalanceLogo} coinCode={coinCode} active={true} alt={coinCode} />
        <div className={`
          ${style.assetBalanceDetailsRow || ''}
          ${!shouldShowUnitPrice ? style.assetBalanceDetailsRowCentered || '' : ''}
        `}>
          <div className={style.assetBalanceDetailsCol}>
            <span
              className={`${style.assetBalanceName || ''}
             ${style.assetBalanceNameFlex || ''}`}
              data-testid={dataTestId}
            >
              {coinName}
            </span>

            {shouldShowUnitPrice && (
              <div data-testid="unit-price-amount">
                <AmountWithUnit
                  alwaysShowAmounts
                  amountClassName={style.unitPrice}
                  amount={unitPrice}
                  convertToFiat
                  removeTrailingZeros
                />
              </div>
            )}
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

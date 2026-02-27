// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { TBalance } from '@/api/account';
import { BalanceSkeleton } from '@/components/balance/balance-skeleton';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { SubTitle } from '@/components/title';
import style from './balance.module.css';

type TProps = {
  balance?: TBalance;
};

export const Balance = ({
  balance,
}: TProps) => {
  const { t } = useTranslation();
  if (!balance) {
    return (
      <BalanceSkeleton />
    );
  }

  return (
    <header className={style.balanceContainer}>
      <SubTitle className={style.availableBalanceTitle}>
        {t('accountSummary.availableBalance')}
      </SubTitle>
      <div className={style.balance} data-testid="availableBalance">
        <AmountWithUnit
          amount={balance.available}
          maxDecimals={9}
          enableRotateUnit
          unitClassName={style.unit}
        />
        {' '}
        <AmountWithUnit
          amount={balance.available}
          enableRotateUnit
          unitClassName={style.unit}
          convertToFiat
        />
      </div>
      {balance.hasIncoming && (
        <p className={style.pendingBalance}>
          {t('account.incoming')}
          {' '}
          <span
            className={style.incomingBalance}
            data-testid="incomingBalance">
            +<AmountWithUnit amount={balance.incoming} maxDecimals={9} />
            {' '}
            <span className={style.incomingConversion}>
              /&nbsp;
              <AmountWithUnit
                amount={balance.incoming}
                convertToFiat
              />
            </span>
          </span>
        </p>
      )}
    </header>
  );
};

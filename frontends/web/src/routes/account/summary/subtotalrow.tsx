// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Logo } from '@/components/icon/logo';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import style from './accountssummary.module.css';

type TProps = {
  balance?: accountApi.TAmountWithConversions;
  coinCode: accountApi.CoinCode;
  coinName: string;
};

export const SubTotalRow = ({ coinCode, coinName, balance }: TProps) => {
  const { t } = useTranslation();
  const nameCol = (
    <td data-label={t('accountSummary.total')}>
      <div className={style.coinName}>
        <Logo className={style.coincode} coinCode={coinCode} active={true} alt={coinCode} />
        <strong className={style.showOnTableView}>
          {t('accountSummary.subtotalWithCoinName', { coinName })}
        </strong>
        <strong className={style.showInCollapsedView}>
          { coinName }
        </strong>
      </div>
    </td>
  );
  if (!balance) {
    return null;
  }
  return (
    <tr key={`${coinCode}_subtotal`} className={style.subTotal}>
      { nameCol }
      <td data-label={t('accountSummary.balance')}>
        <span className={style.summaryTableBalance}>
          <AmountWithUnit
            amount={balance}
            maxDecimals={9}
            unitClassName={style.coinUnit}
          />
        </span>
      </td>
      <td data-label={t('accountSummary.fiatBalance')}>
        <strong>
          <AmountWithUnit amount={balance} convertToFiat/>
        </strong>
      </td>
    </tr>
  );
};

export const SubTotalCoinRow = ({ coinCode, coinName, balance }: TProps) => {
  const { t } = useTranslation();
  const nameCol = (
    <td data-label={t('accountSummary.total')}>
      <div className={style.coinName}>
        <Logo className={style.coincode} coinCode={coinCode} active={true} alt={coinCode} />
        <span className={style.showOnTableView}>
          {coinName}
        </span>
      </div>
    </td>
  );
  if (!balance) {
    return null;
  }
  return (
    <tr key={`${coinCode}_subtotal`} className={style.subTotal}>
      { nameCol }
      <td data-label={t('accountSummary.balance')}>
        <span className={style.summaryTableBalance}>
          <AmountWithUnit
            amount={balance}
            maxDecimals={9}
            unitClassName={style.coinUnit}
          />
        </span>
      </td>
      <td data-label={t('accountSummary.fiatBalance')}>
        <AmountWithUnit amount={balance} convertToFiat/>
      </td>
    </tr>
  );
};

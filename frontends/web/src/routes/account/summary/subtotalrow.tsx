/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Logo } from '@/components/icon/logo';
import { Amount } from '@/components/amount/amount';
import style from './accountssummary.module.css';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';

type TProps = {
  balance?: accountApi.IAmount;
  coinCode: accountApi.CoinCode;
  coinName: string;
};

export const SubTotalRow = ({ coinCode, coinName, balance }: TProps) => {
  const { t } = useTranslation();
  const nameCol = (
    <td data-label={t('accountSummary.total')}>
      <div className={style.coinName}>
        <Logo
          className={style.coincode}
          coinCode={coinCode}
          active={true}
          alt={coinCode}
        />
        <strong className={style.showOnTableView}>
          {t('accountSummary.subtotalWithCoinName', { coinName })}
        </strong>
        <strong className={style.showInCollapsedView}>{coinName}</strong>
      </div>
    </td>
  );
  if (!balance) {
    return null;
  }
  return (
    <tr key={`${coinCode}_subtotal`} className={style.subTotal}>
      {nameCol}
      <td data-label={t('accountSummary.balance')}>
        <span className={style.summaryTableBalance}>
          <strong>
            <Amount amount={balance.amount} unit={balance.unit} />
          </strong>{' '}
          <span className={style.coinUnit}>{balance.unit}</span>
        </span>
      </td>
      <td data-label={t('accountSummary.fiatBalance')}>
        <strong>
          <AmountWithUnit amount={balance} convertToFiat />
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
        <Logo
          className={style.coincode}
          coinCode={coinCode}
          active={true}
          alt={coinCode}
        />
        <span className={style.showOnTableView}>{coinName}</span>
      </div>
    </td>
  );
  if (!balance) {
    return null;
  }
  return (
    <tr key={`${coinCode}_subtotal`} className={style.subTotal}>
      {nameCol}
      <td data-label={t('accountSummary.balance')}>
        <span className={style.summaryTableBalance}>
          <Amount amount={balance.amount} unit={balance.unit} />{' '}
          <span className={style.coinUnit}>{balance.unit}</span>
        </span>
      </td>
      <td data-label={t('accountSummary.fiatBalance')}>
        <AmountWithUnit amount={balance} convertToFiat />
      </td>
    </tr>
  );
};

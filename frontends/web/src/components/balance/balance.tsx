/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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
import { TBalanceResult } from '../../api/account';
import { FiatConversion } from '../../components/rates/rates';
import { bitcoinRemoveTrailingZeroes } from '../../utils/trailing-zeroes';
import style from './balance.module.css';

type TProps = {
    balance?: TBalanceResult;
    noRotateFiat?: boolean;
}

export const Balance = ({
  balance,
  noRotateFiat,
}: TProps) => {
  const { t } = useTranslation();
  if (!balance) {
    return (
      <header className={style.balance}></header>
    );
  }
  if (!balance.success) {
    return (
      <header className={style.balance}>{t('account.balanceError')}</header>
    );
  }

  // remove trailing zeroes from Bitcoin balance
  const availableBalance = bitcoinRemoveTrailingZeroes(balance.available.amount, balance.available.unit);
  const incomingBalance = bitcoinRemoveTrailingZeroes(balance.incoming.amount, balance.incoming.unit);

  return (
    <header className={style.balance}>
      <table className={style.balanceTable}>
        <tbody>
          <tr data-testid="availableBalance">
            <td className={style.availableAmount}>{availableBalance}</td>
            <td className={style.availableUnit}>{balance.available.unit}</td>
          </tr>
          <FiatConversion amount={balance.available} tableRow noAction={noRotateFiat} noBtcZeroes/>
        </tbody>
      </table>
      {
        balance.hasIncoming && (
          <p data-testid="incomingBalance" className={style.pendingBalance}>
            {t('account.incoming')} +{incomingBalance} {balance.incoming.unit} /
            <span className={style.incomingConversion}>
              {' '}
              <FiatConversion amount={balance.incoming} noBtcZeroes/>
            </span>
          </p>
        )
      }
    </header>
  );
};

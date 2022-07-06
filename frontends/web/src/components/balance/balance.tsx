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

import { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { IBalance } from '../../api/account';
import { FiatConversion } from '../../components/rates/rates';
import style from './balance.module.css';

interface Props {
    balance?: IBalance;
}

export const Balance: FunctionComponent<Props> = ({
  balance,
}) => {
  const { t } = useTranslation();
  if (!balance) {
    return (
      <header className={style.balance}></header>
    );
  }
  return (
    <header className={style.balance}>
      <table className={style.balanceTable}>
        <tbody>
          <tr>
            <td className={style.availableAmount}>{balance.available.amount}</td>
            <td className={style.availableUnit}>{balance.available.unit}</td>
          </tr>
          <FiatConversion amount={balance.available} tableRow />
        </tbody>
      </table>
      {
        balance.hasIncoming && (
          <p className={style.pendingBalance}>
            {t('account.incoming')} +{balance.incoming.amount} {balance.incoming.unit} /
            <span className={style.incomingConversion}>
              {' '}
              <FiatConversion amount={balance.incoming} />
            </span>
          </p>
        )
      }
    </header>
  );
};

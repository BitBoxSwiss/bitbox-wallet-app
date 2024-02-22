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
import { useNavigate } from 'react-router-dom';
import { AccountCode, CoinCode, IBalance } from '../../../api/account';
import { syncAddressesCount } from '../../../api/accountsync';
import { useSubscribe } from '../../../hooks/api';
import Logo from '../../../components/icon/logo';
import { Amount } from '../../../components/amount/amount';
import Spinner from '../../../components/spinner/ascii';
import { FiatConversion } from '../../../components/rates/rates';
import style from './accountssummary.module.css';

type TProps = {
  code: AccountCode;
  name: string;
  coinCode: CoinCode;
  balance?: IBalance;
};

export function BalanceRow (
  { code, name, coinCode, balance }: TProps
) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const syncStatus = useSubscribe(syncAddressesCount(code));

  const nameCol = (
    <td
      className={style.clickable}
      data-label={t('accountSummary.name')}
      onClick={() => navigate(code === 'lightning' ? '/lightning' : `/account/${code}`)}>
      <div className={style.coinName}>
        <Logo className={style.coincode} coinCode={coinCode} active={true} alt={coinCode} />
        {name}
      </div>
    </td>
  );
  if (balance) {
    return (
      <tr key={`${code}_balance`}>
        { nameCol }
        <td data-label={t('accountSummary.balance')}>
          <span className={style.summaryTableBalance}>
            <Amount amount={balance.available.amount} unit={balance.available.unit}/>{' '}
            <span className={style.coinUnit}>{balance.available.unit}</span>
          </span>
        </td>
        <td data-label={t('accountSummary.fiatBalance')}>
          <FiatConversion amount={balance.available} noAction={true} />
        </td>
      </tr>
    );
  }
  return (
    <tr key={`${code}_syncing`}>
      { nameCol }
      <td colSpan={2} className={style.syncText}>
        { t('account.syncedAddressesCount', {
          count: syncStatus?.toString(),
          defaultValue: 0,
        } as any) }
        <Spinner />
      </td>
    </tr>
  );
}

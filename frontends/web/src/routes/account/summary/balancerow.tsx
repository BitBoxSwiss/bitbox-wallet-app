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

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountCode, CoinCode, TBalance } from '@/api/account';
import { syncAddressesCount } from '@/api/accountsync';
import { useSubscribe } from '@/hooks/api';
import { useMediaQuery } from '@/hooks/mediaquery';
import { Logo } from '@/components/icon/logo';
import { Amount } from '@/components/amount/amount';
import { AsciiSpinner } from '@/components/spinner/ascii';
import style from './accountssummary.module.css';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';

type TNameColProps = {
  coinCode: CoinCode;
  name: string;
  onClick?: () => void;
};

const NameCell = ({ coinCode, name, onClick }: TNameColProps) => {
  const { t } = useTranslation();
  return (
    <td
      className={style.clickable}
      data-label={t('accountSummary.name')}
      onClick={onClick}
    >
      <div className={style.coinName}>
        <Logo className={style.coincode} coinCode={coinCode} active={true} alt={coinCode} />
        {name}
      </div>
    </td>
  );
};

type TProps = {
  balance?: TBalance;
  code: AccountCode;
  coinCode: CoinCode;
  name: string;
};

export const BalanceRow = (
  { code, name, coinCode, balance }: TProps
) => {
  const { t } = useTranslation();
  const syncStatus = useSubscribe(syncAddressesCount(code));
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const handleClick = () => navigate(`/account/${code}`);

  if (balance) {
    return (
      <tr
        key={`${code}_balance`}
        onClick={() => isMobile && handleClick()}
      >
        <NameCell
          coinCode={coinCode}
          name={name}
          onClick={() => !isMobile && handleClick()}
        />
        <td data-label={t('accountSummary.balance')}>
          <span className={style.summaryTableBalance}>
            <Amount amount={balance.available.amount} unit={balance.available.unit}/>{' '}
            <span className={style.coinUnit}>{balance.available.unit}</span>
          </span>
        </td>
        <td data-label={t('accountSummary.fiatBalance')}>
          <AmountWithUnit amount={balance.available} convertToFiat/>
        </td>
      </tr>
    );
  }
  return (
    <tr key={`${code}_syncing`}>
      <NameCell name={name} coinCode={coinCode} />
      <td colSpan={2} className={style.syncText}>
        { t('account.syncedAddressesCount', {
          count: syncStatus,
          defaultValue: 0,
        }) }
        <AsciiSpinner />
      </td>
    </tr>
  );
};

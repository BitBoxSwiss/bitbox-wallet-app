// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountCode, CoinCode, TBalance } from '@/api/account';
import { syncAddressesCount } from '@/api/accountsync';
import { useSubscribe } from '@/hooks/api';
import { useMediaQuery } from '@/hooks/mediaquery';
import { Logo } from '@/components/icon/logo';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { AsciiSpinner } from '@/components/spinner/ascii';
import style from './accountssummary.module.css';

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
            <AmountWithUnit
              amount={balance.available}
              maxDecimals={9}
              unitClassName={style.coinUnit}
            />
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

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
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { route } from '../../../utils/route';
import { CoinUnit, IAccount, IBalance } from '../../../api/account';
import { Button } from '../../../components/forms';
import { Balances } from '../summary/accountssummary';
import { isBitcoinCoin } from '../utils';
import { getExchangeSupportedAccounts } from '../../buy/utils';
import styles from './buyReceiveCTA.module.css';
import { useMountedRef } from '../../../hooks/mount';

type TBuyReceiveCTAProps = {
  balanceList?: IBalance[];
  code?: string;
  unit?: string;
  exchangeBuySupported?: boolean;
};

type TAddBuyReceiveOnEmpyBalancesProps = {
  balances?: Balances;
  accounts: IAccount[];
}

export const BuyReceiveCTA = ({ code, unit, balanceList, exchangeBuySupported = true }: TBuyReceiveCTAProps) => {
  const formattedUnit = isBitcoinCoin(unit as CoinUnit) ? 'BTC' : unit;
  const { t } = useTranslation();
  const onBuyCTA = () => route(code ? `/buy/info/${code}` : '/buy/info');
  const onReceiveCTA = () => {
    if (balanceList) {
      if (balanceList.length > 1) {
        route('accounts/select-receive');
        return;
      }
      route(`/account/${code}/receive`);
    }
  };

  return (
    <div className={`${styles.main}`}>
      <h3 className="subTitle">{t('accountInfo.buyCTA.information.looksEmpty')}</h3>
      <h3 className="subTitle">{t('accountInfo.buyCTA.information.start')}</h3>
      <div className={styles.container}>
        {balanceList && <Button primary onClick={onReceiveCTA}>{formattedUnit ? t('receive.title', { accountName: formattedUnit }) : t('receive.title', { accountName: t('buy.info.crypto') })}</Button>}
        {exchangeBuySupported && <Button primary onClick={onBuyCTA}>{formattedUnit ? t('accountInfo.buyCTA.buy', { unit: formattedUnit }) : t('accountInfo.buyCTA.buyCrypto')}</Button>}
      </div>
    </div>);
};


export const AddBuyReceiveOnEmptyBalances = ({ balances, accounts }: TAddBuyReceiveOnEmpyBalancesProps) => {
  const mounted = useMountedRef();
  const [supportedAccounts, setSupportedAccounts] = useState<IAccount[]>();

  useEffect(() => {
    if (mounted.current) {
      getExchangeSupportedAccounts(accounts)
        .then(supportedAccounts => {
          if (mounted.current) {
            setSupportedAccounts(supportedAccounts);
          }
        })
        .catch(console.error);
    }
  }, [accounts, mounted]);

  if (balances === undefined || supportedAccounts === undefined) {
    return null;
  }
  const balanceList = accounts
    .map(account => balances[account.code])
    .filter(balance => !!balance);

  if (balanceList.some(entry => entry.hasAvailable)) {
    return null;
  }
  if (balanceList.map(entry => entry.available.unit).every(isBitcoinCoin)) {
    return <BuyReceiveCTA code={accounts.length === 1 ? accounts[0].code : undefined} unit={'BTC'} balanceList={balanceList} />;
  }

  return <BuyReceiveCTA exchangeBuySupported={supportedAccounts.length > 0} balanceList={balanceList} />;
};

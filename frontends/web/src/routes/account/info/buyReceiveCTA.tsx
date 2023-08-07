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
import { useMediaQuery } from '../../../hooks/mediaquery';
import { route } from '../../../utils/route';
import { CoinUnit, IAccount, IBalance } from '../../../api/account';
import { Button } from '../../../components/forms';
import { Balances } from '../summary/accountssummary';
import { isBitcoinCoin, isEthereumBased } from '../utils';
import { getExchangeSupportedAccounts } from '../../buy/utils';
import { WalletConnectLight } from '../../../components/icon';
import styles from './buyReceiveCTA.module.css';

type TBuyReceiveCTAProps = {
  balanceList?: [string, IBalance][];
  code?: string;
  unit?: string;
  exchangeBuySupported?: boolean;
  account?: IAccount
};

type TAddBuyReceiveOnEmpyBalancesProps = {
  balances?: Balances;
  accounts: IAccount[];
}

export const BuyReceiveCTA = ({ code, unit, balanceList, exchangeBuySupported = true, account }: TBuyReceiveCTAProps) => {
  const formattedUnit = isBitcoinCoin(unit as CoinUnit) ? 'BTC' : unit;
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const onBuyCTA = () => route(code ? `/buy/info/${code}` : '/buy/info');
  const onWalletConnect = () => route(`/account/${code}/wallet-connect/connect`);
  const onReceiveCTA = () => {
    if (balanceList) {
      if (balanceList.length > 1) {
        route('accounts/select-receive');
        return;
      }
      route(`/account/${balanceList[0][0]}/receive`);
    }
  };

  return (
    <div className={`${styles.main}`}>
      <h3 className="subTitle">{t('accountInfo.buyCTA.information.looksEmpty')}</h3>
      <h3 className="subTitle">{t('accountInfo.buyCTA.information.start')}</h3>
      <div className={styles.container}>
        {balanceList && <Button primary onClick={onReceiveCTA}>{formattedUnit ? t('receive.title', { accountName: formattedUnit }) : t('receive.title', { accountName: t('buy.info.crypto') })}</Button>}
        {exchangeBuySupported && <Button primary onClick={onBuyCTA}>{formattedUnit ? t('accountInfo.buyCTA.buy', { unit: formattedUnit }) : t('accountInfo.buyCTA.buyCrypto')}</Button>}
        {account && isEthereumBased(account.coinCode) && !account.isToken && <Button primary onClick={onWalletConnect} className={styles.walletConnect}>{isMobile ? <WalletConnectLight /> : <><WalletConnectLight /> <span>Wallet Connect</span></>}</Button>}
      </div>
    </div>);
};


export const AddBuyReceiveOnEmptyBalances = ({ balances, accounts }: TAddBuyReceiveOnEmpyBalancesProps) => {

  const [supportedAccounts, setSupportedAccounts] = useState<IAccount[]>();

  useEffect(() => {
    getExchangeSupportedAccounts(accounts).then(setSupportedAccounts);
  }, [accounts]);

  if (balances === undefined || supportedAccounts === undefined) {
    return null;
  }
  const balanceList = Object.entries(balances);
  if (balanceList.some(entry => entry[1].hasAvailable)) {
    return null;
  }
  if (balanceList.map(entry => entry[1].available.unit).every(isBitcoinCoin)) {
    const onlyHasOneAccount = balanceList.length === 1;
    return <BuyReceiveCTA code={onlyHasOneAccount ? balanceList[0][0] : undefined} unit={'BTC'} balanceList={balanceList} />;
  }

  return <BuyReceiveCTA exchangeBuySupported={supportedAccounts.length > 0} balanceList={balanceList} />;
};

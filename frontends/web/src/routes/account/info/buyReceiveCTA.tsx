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
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/mediaquery';
import { CoinUnit, IAccount, IBalance } from '@/api/account';
import { Button } from '@/components/forms';
import { Balances } from '@/routes/account/summary/accountssummary';
import { isBitcoinCoin, isEthereumBased } from '@/routes/account/utils';
import { getExchangeSupportedAccounts } from '@/routes/exchange/utils';
import { WalletConnectLight } from '@/components/icon';
import { useMountedRef } from '@/hooks/mount';
import styles from './buyReceiveCTA.module.css';

type TBuyReceiveCTAProps = {
  balanceList?: IBalance[];
  code?: string;
  unit?: string;
  exchangeBuySupported?: boolean;
  account?: IAccount;
};

type TAddBuyReceiveOnEmpyBalancesProps = {
  balances?: Balances;
  accounts: IAccount[];
}

export const BuyReceiveCTA = ({
  balanceList,
  code,
  unit,
  exchangeBuySupported = true,
  account,
}: TBuyReceiveCTAProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isBitcoin = isBitcoinCoin(unit as CoinUnit);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const onBuyCTA = () => navigate(code ? `/exchange/info/${code}` : '/exchange/info');
  const onWalletConnect = () => navigate(`/account/${code}/wallet-connect/dashboard`);
  const onReceiveCTA = () => {
    if (balanceList) {
      if (balanceList.length > 1) {
        navigate('/accounts/select-receive');
        return;
      }
      navigate(`/account/${code}/receive`);
    }
  };

  return (
    <div className={`${styles.main}`}>
      <h3 className="subTitle">
        {t('accountInfo.buyCTA.information.looksEmpty')}
      </h3>
      <h3 className="subTitle">
        {t('accountInfo.buyCTA.information.start')}
      </h3>
      <div className={styles.container}>
        {balanceList && (
          <Button primary onClick={onReceiveCTA}>
            {/* "Receive Bitcoin", "Receive crypto" or "Receive LTC" (via placeholder "Receive {{coinCode}}") */}
            {t('generic.receive', {
              context: isBitcoin ? 'bitcoin' : (unit ? '' : 'crypto'),
              coinCode: unit
            })}
          </Button>
        )}
        {exchangeBuySupported && (
          <Button primary onClick={onBuyCTA}>
            {/* "Buy Bitcoin", "Buy crypto" or "Buy LTC" (via placeholder "Buy {{coinCode}}") */}
            {t('generic.buy', {
              context: isBitcoin ? 'bitcoin' : (unit ? '' : 'crypto'),
              coinCode: unit
            })}
          </Button>
        )}
        {account && isEthereumBased(account.coinCode) && !account.isToken && (
          <Button primary onClick={onWalletConnect} className={styles.walletConnect}>
            {isMobile ? (
              <WalletConnectLight width={28} height={28} />
            ) : (
              <>
                <WalletConnectLight width={28} height={28} /> <span>Wallet Connect</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export const AddBuyReceiveOnEmptyBalances = ({ balances, accounts }: TAddBuyReceiveOnEmpyBalancesProps) => {
  const mounted = useMountedRef();
  const [supportedAccounts, setSupportedAccounts] = useState<IAccount[]>();
  const onlyHasOneActiveAccount = accounts.length === 1;

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
  const balanceList = (
    accounts
      .map(account => balances[account.code])
      .filter(balance => !!balance)
  );

  // at least 1 active account has balance
  if (balanceList.some(entry => entry.hasAvailable)) {
    return null;
  }

  // all active accounts are bitcoin
  if (balanceList.map(entry => entry.available.unit).every(isBitcoinCoin)) {
    return (
      <BuyReceiveCTA
        balanceList={balanceList}
        code={onlyHasOneActiveAccount ? accounts[0].code : undefined}
        unit="BTC"
      />
    );
  }

  return (
    <BuyReceiveCTA
      balanceList={balanceList}
      exchangeBuySupported={supportedAccounts.length > 0}
    />
  );
};

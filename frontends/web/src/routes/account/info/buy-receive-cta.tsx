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
import type { AccountCode, CoinUnit, IAccount, IBalance } from '@/api/account';
import { useMediaQuery } from '@/hooks/mediaquery';
import { Button } from '@/components/forms';
import { Balances } from '@/routes/account/summary/accountssummary';
import { isBitcoinCoin, isEthereumBased } from '@/routes/account/utils';
import { getExchangeSupportedAccounts } from '@/routes/exchange/utils';
import { WalletConnectLight } from '@/components/icon';
import { useMountedRef } from '@/hooks/mount';
import { SubTitle } from '@/components/title';
import styles from './buy-receive-cta.module.css';

type TBuyReceiveCTAProps = {
  balanceList?: IBalance[];
  code?: AccountCode;
  unit?: CoinUnit;
  exchangeSupported?: boolean;
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
  exchangeSupported = true,
  account,
}: TBuyReceiveCTAProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isBitcoin = isBitcoinCoin(unit as CoinUnit);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const onExchangeCTA = () => navigate(code ? `/exchange/info/${code}` : '/exchange/info');
  const onWalletConnect = () => code && navigate(`/account/${code}/wallet-connect/dashboard`);
  const onReceiveCTA = () => {
    if (balanceList) {
      if (balanceList.length > 1) {
        navigate('/accounts/select-receive');
        return;
      }
      if (code) {
        navigate(`/account/${code}/receive`);
      }
    }
  };

  return (
    <div className={styles.container}>
      <SubTitle>
        {t('accountInfo.buyCTA.information.looksEmpty')}
      </SubTitle>
      <p>
        {t('accountInfo.buyCTA.information.start')}
      </p>
      <div className={styles.buttons}>
        {balanceList && (
          <Button primary onClick={onReceiveCTA}>
            {/* "Receive Bitcoin", "Receive crypto" or "Receive LTC" (via placeholder "Receive {{coinCode}}") */}
            {t('generic.receive', {
              context: isBitcoin ? 'bitcoin' : (unit ? '' : 'crypto'),
              coinCode: unit
            })}
          </Button>
        )}
        {(exchangeSupported && !isMobile) && (
          <Button primary onClick={onExchangeCTA}>
            {/* "Exchange Bitcoin", "Exchange crypto" or "Exchange LTC" (via placeholder "Exchange {{coinCode}}") */}
            {t('generic.buySell')}
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
      exchangeSupported={supportedAccounts.length > 0}
    />
  );
};

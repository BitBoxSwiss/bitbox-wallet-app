/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import * as accountApi from '../../api/account';
import { syncAddressesCount } from '../../api/accountsync';
import { TDevices } from '../../api/devices';
import { isMoonpayBuySupported } from '../../api/backend';
import { useSDCard } from '../../hooks/sdcard';
import { unsubscribe, UnsubscribeList } from '../../utils/subscriptions';
import { statusChanged, syncdone } from '../../api/subscribe-legacy';
import { alertUser } from '../../components/alert/Alert';
import { Balance } from '../../components/balance/balance';
import { AccountGuide } from './guide';
import { HeadersSync } from '../../components/headerssync/headerssync';
import { Header } from '../../components/layout';
import { Info } from '../../components/icon';
import { Spinner } from '../../components/spinner/Spinner';
import Status from '../../components/status/status';
import { Transactions } from '../../components/transactions/transactions';
import { apiGet } from '../../utils/request';
import { BuyCTA } from './info/buyCTA';
import style from './account.module.css';
import { isBitcoinBased } from './utils';

// Show some additional info for the following coin types, if legacy split acocunts is enabled.
const WithCoinTypeInfo = [
  'btc-p2pkh',
  'btc-p2wpkh',
  'btc-p2wpkh-p2sh',
  'tbtc-p2pkh',
  'tbtc-p2wpkh',
  'tbtc-p2wpkh-p2sh',
];

type Props = {
  accounts: accountApi.IAccount[];
  code: string;
  devices: TDevices;
};

export function Account({
  accounts,
  code,
  devices,
}: Props) {
  const { t } = useTranslation();

  const [balance, setBalance] = useState<accountApi.IBalance>();
  const [moonpayBuySupported, setMoonpayBuySupported] = useState<boolean>();
  const [status, setStatus] = useState<accountApi.IStatus>();
  const [syncedAddressesCount, setSyncedAddressesCount] = useState<number>();
  const [transactions, setTransactions] = useState<accountApi.ITransaction[]>();
  const [usesProxy, setUsesProxy] = useState<boolean>();

  useEffect(() => {
    apiGet('config').then(({ backend }) => setUsesProxy(backend.proxy.useProxy));
  });

  const deviceIDs = useRef<string[]>(Object.keys(devices));
  useEffect(() => {
    deviceIDs.current = Object.keys(devices);
  }, [devices]);

  const hasCard = useSDCard(devices, [devices, code]);

  const onAccountChanged = useCallback(() => {
    if (!code || status === undefined || status.fatalError) {
      return;
    }
    if (status.synced && status.offlineError === null) {
      const currentCode = code;
      Promise.all([
        accountApi.getBalance(currentCode).then(newBalance => {
          if (currentCode !== code) {
            // Results came in after the account was switched. Ignore.
            return;
          }
          setBalance(newBalance);
        }),
        accountApi.getTransactionList(code).then(newTransactions => {
          if (currentCode !== code) {
            // Results came in after the account was switched. Ignore.
            return;
          }
          setTransactions(newTransactions);
        })
      ])
        .catch(console.error);
    } else {
      setBalance(undefined);
      setTransactions(undefined);
    }
  }, [code, status]);

  const onStatusChanged = useCallback(() => {
    const currentCode = code;
    if (!currentCode) {
      return;
    }
    accountApi.getStatus(currentCode).then(status => {
      if (currentCode !== code) {
        // Results came in after the account was switched. Ignore.
        return;
      }
      if (!status.disabled) {
        if (!status.synced) {
          accountApi.init(currentCode).catch(console.error);
        }
      }
      setStatus(status);
    })
      .catch(console.error);
  }, [code]);

  useEffect(onAccountChanged, [onAccountChanged, status]);

  const subscriptions = useRef<UnsubscribeList>([]);
  useEffect(() => {
    unsubscribe(subscriptions.current);
    subscriptions.current.push(
      syncAddressesCount(code, (givenCode, addressesSynced) => {
        if (givenCode === code) {
          setSyncedAddressesCount(addressesSynced);
        }
      }),
      statusChanged(code, () => onStatusChanged()),
      syncdone(code, () => onAccountChanged()),
    );

    if (status === undefined) {
      onStatusChanged();
    }

    const unsubscribeList = subscriptions.current;
    return () => unsubscribe(unsubscribeList); // TODO: test if subscriptions.current works
  }, [code, onAccountChanged, onStatusChanged, status]);

  useEffect(() => {
    isMoonpayBuySupported(code)()
      .then(buySupported => setMoonpayBuySupported(buySupported));
  }, [code]);

  function exportAccount() {
    if (status === undefined || status.fatalError) {
      return;
    }
    accountApi.exportAccount(code)
      .then(result => {
        if (result !== null && !result.success) {
          alertUser(result.errorMessage);
        }
      })
      .catch(console.error);
  }

  useEffect(() => {
    setBalance(undefined);
    setStatus(undefined);
    setSyncedAddressesCount(0);
    setTransactions(undefined);
  }, [code]);

  const hasDataLoaded = balance !== undefined && transactions !== undefined;

  if (!code) { // TODO: needed?
    return null;
  }

  const account = accounts && accounts.find(acct => acct.code === code);
  if (!account || status === undefined) {
    return null;
  }

  const canSend = balance && balance.available.amount !== '0';

  const initializingSpinnerText =
    (syncedAddressesCount !== undefined && syncedAddressesCount > 1) ? (
      '\n' + t('account.syncedAddressesCount', {
        count: syncedAddressesCount.toString(),
        defaultValue: 0,
      } as any)
    ) : '';

  const offlineErrorTextLines: string[] = [];
  if (status.offlineError !== null) {
    offlineErrorTextLines.push(t('account.reconnecting'));
    offlineErrorTextLines.push(status.offlineError);
    if (usesProxy) {
      offlineErrorTextLines.push(t('account.maybeProxyError'));
    }
  }

  const showBuyButton = moonpayBuySupported
    && balance
    && balance.available.amount === '0'
    && !balance.hasIncoming
    && transactions && transactions.length === 0;

  return (
    <div className="contentWithGuide">
      <div className="container">
        <Status hidden={!hasCard} type="warning">
          {t('warning.sdcard')}
        </Status>
        <Header
          title={<h2><span>{account.name}</span></h2>}>
          <Link to={`/account/${code}/info`} title={t('accountInfo.title')} className="flex flex-row flex-items-center">
            <Info className={style.accountIcon} />
            <span>{t('accountInfo.label')}</span>
          </Link>
        </Header>
        {status.synced && hasDataLoaded && isBitcoinBased(account.coinCode) && (
          <HeadersSync coinCode={account.coinCode} />
        )}
        <div className="innerContainer scrollableContainer">
          <div className="content padded">
            { showBuyButton && (
              <BuyCTA
                code={code}
                unit={balance.available.unit} />
            )}
            <Status
              className="m-bottom-default"
              hidden={!WithCoinTypeInfo.includes(code)}
              dismissable={`info-${code}`}
              type="info">
              {t(`account.info.${code}`)}
            </Status>
            <div className="flex flex-row flex-between flex-items-center flex-column-mobile flex-reverse-mobile">
              <label className="labelXLarge flex-self-start-mobile">
                {t('accountSummary.availableBalance')}
              </label>
              <div className={style.actionsContainer}>
                {canSend ? (
                  <Link key="sendLink" to={`/account/${code}/send`} className={style.send}>
                    <span>{t('button.send')}</span>
                  </Link>
                ) : (
                  <span key="sendDisabled" className={`${style.send} ${style.disabled}`}>
                    {t('button.send')}
                  </span>
                )}
                <Link key="receive" to={`/account/${code}/receive`} className={style.receive}>
                  <span>{t('button.receive')}</span>
                </Link>
                { moonpayBuySupported && (
                  <Link key="buy" to={`/buy/info/${code}`} className={style.buy}>
                    <span>{t('button.buy')}</span>
                  </Link>
                )}
              </div>
            </div>
            <div className="box large">
              <Balance balance={balance} />
            </div>
            { !status.synced || offlineErrorTextLines.length || !hasDataLoaded || status.fatalError ? (
              <Spinner text={
                (status.fatalError && t('account.fatalError'))
                  || offlineErrorTextLines.join('\n')
                  || (!status.synced &&
                      t('account.initializing')
                      + initializingSpinnerText
                  )
                  || ''
              } />
            ) : (
              <Transactions
                accountCode={code}
                handleExport={exportAccount}
                explorerURL={account.blockExplorerTxPrefix}
                transactions={transactions}
              />
            ) }
          </div>
        </div>
      </div>
      <AccountGuide
        account={account}
        unit={balance?.available.unit}
        hasIncomingBalance={balance && balance.hasIncoming}
        hasTransactions={transactions !== undefined && transactions.length > 0}
        hasNoBalance={balance && balance.available.amount === '0'} />
    </div>
  );
}

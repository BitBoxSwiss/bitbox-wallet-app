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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLoad, useSync } from '../../hooks/api';
import * as accountApi from '../../api/account';
import { getStatus, subscribeStatus } from '../../api/lightning';
import { TDevices } from '../../api/devices';
import { getExchangeBuySupported, SupportedExchanges } from '../../api/exchanges';
import { alertUser } from '../../components/alert/Alert';
import { Balance } from '../../components/balance/balance';
import { Header } from '../../components/layout';
import { Info } from '../../components/icon';
import { Spinner } from '../../components/spinner/Spinner';
import { Transactions } from '../../components/transactions/transactions';
import { BuyReceiveCTA } from '../account/info/buyReceiveCTA';
import { ActionButtons } from '../account/actionButtons';
import style from './lightning.module.css';
import { LightningGuide } from './guide';

type Props = {
  accounts: accountApi.IAccount[];
  code: string;
  devices: TDevices;
};

export function Lightning({ accounts, code }: Props) {
  const { t } = useTranslation();

  const [balance, setBalance] = useState<accountApi.IBalance>();
  const [syncedAddressesCount] = useState<number>();
  const [transactions] = useState<accountApi.TTransactions>();
  const [stateCode, setStateCode] = useState<string>();
  const status = useSync(() => getStatus(code), subscribeStatus(code));
  const supportedExchanges = useLoad<SupportedExchanges>(getExchangeBuySupported(code), [code]);

  useEffect(() => {
    if (status) {
      console.log(status.blockHeight);
      setBalance({
        hasAvailable: status.localBalance > 0,
        available: {
          amount: `${status.localBalance}`,
          unit: 'sat'
        },
        hasIncoming: false,
        incoming: {
          amount: '0',
          unit: 'sat'
        }
      });
    }
  }, [status, status?.localBalance]);

  function exportAccount() {
    accountApi
      .exportAccount(code)
      .then((result) => {
        if (result !== null && !result.success) {
          alertUser(result.errorMessage);
        }
      })
      .catch(console.error);
  }

  useEffect(() => {
    setStateCode(code);
  }, [code]);

  const hasDataLoaded = balance !== undefined;

  const account = accounts && accounts.find((acct) => acct.code === code);
  if (!account || !status || stateCode !== code) {
    // Sync code property with stateCode to work around a re-render that
    // happens briefly before `setStatus(undefined)` stops rendering again below.
    return null;
  }

  const canSend = balance && balance.hasAvailable;

  const initializingSpinnerText =
    syncedAddressesCount !== undefined && syncedAddressesCount > 1
      ? '\n' +
        t('account.syncedAddressesCount', {
          count: syncedAddressesCount.toString(),
          defaultValue: 0
        } as any)
      : '';

  const offlineErrorTextLines: string[] = [];

  const exchangeBuySupported = supportedExchanges && supportedExchanges.exchanges.length > 0;

  const isAccountEmpty =
    balance && !balance.hasAvailable && !balance.hasIncoming && transactions && transactions.success && transactions.list.length === 0;

  const actionButtonsProps = {
    code,
    canSend,
    exchangeBuySupported
  };

  return (
    <div className="contentWithGuide">
      <div className="container">
        <Header
          title={
            <h2>
              <span>{account.name + ' Lightning'}</span>
            </h2>
          }
        >
          <Link to={`/account/${code}/info`} title={t('accountInfo.title')} className="flex flex-row flex-items-center">
            <Info className={style.accountIcon} />
            <span>{t('accountInfo.label')}</span>
          </Link>
        </Header>
        <div className="innerContainer scrollableContainer">
          <div className="content padded">
            <div className="flex flex-column flex-reverse-mobile">
              <label className="labelXLarge flex-self-start-mobile hide-on-small">{t('accountSummary.availableBalance')}</label>
              <div className="flex flex-row flex-between flex-item-center flex-column-mobile flex-reverse-mobile">
                <Balance balance={balance} />
                <label className="labelXLarge flex-self-start-mobile show-on-small">{t('accountSummary.availableBalance')}</label>
                {!isAccountEmpty && <ActionButtons {...actionButtonsProps} />}
              </div>
            </div>
            {isAccountEmpty && (
              <BuyReceiveCTA
                code={code}
                exchangeBuySupported={exchangeBuySupported}
                unit={balance.available.unit}
                balanceList={[[code, balance]]}
              />
            )}
            {offlineErrorTextLines.length || !hasDataLoaded ? (
              <Spinner guideExists text={initializingSpinnerText} />
            ) : (
              <>
                {!isAccountEmpty && (
                  <Transactions
                    accountCode={code}
                    handleExport={exportAccount}
                    explorerURL={account.blockExplorerTxPrefix}
                    transactions={transactions}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <LightningGuide
        unit="sats"
        hasTransactions={transactions !== undefined && transactions.success && transactions.list.length > 0}
        hasNoBalance={balance && balance.available.amount === '0'}
      />
    </div>
  );
}

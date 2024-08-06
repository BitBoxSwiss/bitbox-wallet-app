/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022-2024 Shift Crypto AG
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

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import * as accountApi from '@/api/account';
import { statusChanged, syncAddressesCount, syncdone } from '@/api/accountsync';
import { bitsuranceLookup } from '@/api/bitsurance';
import { TDevices } from '@/api/devices';
import { getExchangeBuySupported, SupportedExchanges } from '@/api/exchanges';
import { useSDCard } from '@/hooks/sdcard';
import { unsubscribe } from '@/utils/subscriptions';
import { alertUser } from '@/components/alert/Alert';
import { Balance } from '@/components/balance/balance';
import { HeadersSync } from '@/components/headerssync/headerssync';
import { Info } from '@/components/icon';
import { Header } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { Status } from '@/components/status/status';
import { Transactions } from '@/components/transactions/transactions';
import { useLoad } from '@/hooks/api';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { ActionButtons } from './actionButtons';
import { Insured } from './components/insuredtag';
import { AccountGuide } from './guide';
import { BuyReceiveCTA } from './info/buyReceiveCTA';
import { isBitcoinBased } from './utils';
import { getScriptName } from './utils';
import { MultilineMarkup } from '@/utils/markup';
import { Dialog } from '@/components/dialog/dialog';
import { A } from '@/components/anchor/anchor';
import { getConfig, setConfig } from '@/utils/config';
import { i18n } from '@/i18n/i18n';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/globalbanners/globalbanners';
import style from './account.module.css';

type Props = {
  accounts: accountApi.IAccount[];
  code: accountApi.AccountCode;
  devices: TDevices;
};

export const Account = ({
  accounts,
  code,
  devices,
}: Props) => {
  const { t } = useTranslation();

  const [balance, setBalance] = useState<accountApi.IBalance>();
  const [status, setStatus] = useState<accountApi.IStatus>();
  const [syncedAddressesCount, setSyncedAddressesCount] = useState<number>();
  const [transactions, setTransactions] = useState<accountApi.TTransactions>();
  const [usesProxy, setUsesProxy] = useState<boolean>();
  const [insured, setInsured] = useState<boolean>(false);
  const [uncoveredFunds, setUncoveredFunds] = useState<string[]>([]);
  const [offlineErrorTextLines, setOfflineErrorTextLines] = useState<string[]>([]);
  const supportedExchanges = useLoad<SupportedExchanges>(getExchangeBuySupported(code), [code]);

  const account = accounts && accounts.find(acct => acct.code === code);

  const getBitsuranceGuideLink = (): string => {
    switch (i18n.resolvedLanguage) {
    case 'de':
      return 'https://bitbox.swiss/redirects/bitsurance-segwit-migration-guide-de/';
    default:
      return 'https://bitbox.swiss/redirects/bitsurance-segwit-migration-guide-en/';
    }
  };

  const checkUncoveredUTXOs = useCallback(async () => {
    const uncoveredScripts: accountApi.ScriptType[] = [];
    const utxos = await accountApi.getUTXOs(code);
    utxos.forEach((utxo) => {
      if (utxo.scriptType !== 'p2wpkh' && !uncoveredScripts.includes(utxo.scriptType)) {
        uncoveredScripts.push(utxo.scriptType);
      }
    });
    setUncoveredFunds(uncoveredScripts.map(getScriptName));
  }, [code]);

  const maybeCheckBitsuranceStatus = useCallback(async () => {
    if (account?.bitsuranceStatus) {
      const insuredAccounts = await bitsuranceLookup(code);
      if (!insuredAccounts.success) {
        alertUser(insuredAccounts.errorMessage || t('genericError'));
        return;
      }

      // we fetch the config after the lookup as it could have changed.
      const config = await getConfig();
      let cancelledAccounts: string[] = config.frontend.bitsuranceNotifyCancellation;
      if (cancelledAccounts?.some(accountCode => accountCode === code)) {
        alertUser(t('account.insuranceExpired'));
        // remove the pending notification from the frontend settings.
        config.frontend.bitsuranceNotifyCancellation = cancelledAccounts.filter(accountCode => accountCode !== code);
        setConfig(config);
      }

      let bitsuranceAccount = insuredAccounts.bitsuranceAccounts[0];
      if (bitsuranceAccount.status === 'active') {
        setInsured(true);
        checkUncoveredUTXOs();
        return;
      }
    }
    setInsured(false);
  }, [t, account, code, checkUncoveredUTXOs]);

  useEffect(() => {
    maybeCheckBitsuranceStatus();
    getConfig().then(({ backend }) => setUsesProxy(backend.proxy.useProxy));
  }, [maybeCheckBitsuranceStatus]);

  const hasCard = useSDCard(devices, [code]);

  const onAccountChanged = useCallback((
    code: accountApi.AccountCode,
    status: accountApi.IStatus | undefined,
  ) => {
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
  }, []);

  const onStatusChanged = useCallback(() => {
    const currentCode = code;
    if (!currentCode) {
      return;
    }
    accountApi.getStatus(currentCode).then(async status => {
      if (currentCode !== code) {
        // Results came in after the account was switched. Ignore.
        return;
      }
      setStatus(status);
      if (!status.disabled && !status.synced) {
        await accountApi.init(currentCode).catch(console.error);
      }
      onAccountChanged(code, status);
    })
      .catch(console.error);
  }, [onAccountChanged, code]);

  useEffect(() => {
    if (status && status.offlineError !== null) {
      const errors = [
        t('account.reconnecting'),
        status.offlineError,
      ];
      if (usesProxy) {
        errors.push(t('account.maybeProxyError'));
      }
      setOfflineErrorTextLines(errors);
    }
  }, [status, t, usesProxy]);

  useEffect(() => {
    const subscriptions = [
      syncAddressesCount(code)(setSyncedAddressesCount),
      statusChanged((eventCode) => eventCode === code && onStatusChanged()),
      syncdone((eventCode) => eventCode === code && onAccountChanged(code, status)),
    ];
    return () => unsubscribe(subscriptions);
  }, [code, onAccountChanged, onStatusChanged, status]);

  const exportAccount = () => {
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
  };

  useEffect(() => {
    setBalance(undefined);
    setStatus(undefined);
    setSyncedAddressesCount(0);
    setTransactions(undefined);
    onStatusChanged();
  }, [code, onStatusChanged]);

  const hasDataLoaded = balance !== undefined && transactions !== undefined;

  if (status?.fatalError) {
    return (
      <Spinner guideExists text={t('account.fatalError')} />
    );
  }

  if (status && !status.synced && syncedAddressesCount) {
    const text =
      (syncedAddressesCount !== undefined && syncedAddressesCount > 1) ? (
        '\n' + t('account.syncedAddressesCount', {
          count: syncedAddressesCount.toString(),
          defaultValue: 0,
        } as any)
      ) : '';

    return (
      <Spinner guideExists text={
        t('account.initializing') + text
      } />
    );
  }

  const exchangeBuySupported = supportedExchanges && supportedExchanges.exchanges.length > 0;

  const isAccountEmpty = balance
    && !balance.hasAvailable
    && !balance.hasIncoming
    && transactions
    && transactions.success
    && transactions.list.length === 0;


  const actionButtonsProps = account && {
    code,
    coinCode: account.coinCode,
    canSend: balance && balance.hasAvailable,
    exchangeBuySupported,
    account
  };

  return (
    <div className="contentWithGuide">
      <div className="container">
        <ContentWrapper>
          <GlobalBanners />
          <Status key="sdcard" type="warning" hidden={!hasCard}>
            {t('warning.sdcard')}
          </Status>
          <Status key="offline" type="error" hidden={!offlineErrorTextLines.length}>
            {offlineErrorTextLines.join('\n')}
          </Status>
        </ContentWrapper>
        <Dialog open={insured && uncoveredFunds.length !== 0} medium title={t('account.warning')} onClose={() => setUncoveredFunds([])}>
          <MultilineMarkup tagName="p" markup={t('account.uncoveredFunds', {
            name: account?.name,
            uncovered: uncoveredFunds,
          })} />
          <A href={getBitsuranceGuideLink()}>{t('account.uncoveredFundsLink')}</A>
        </Dialog>
        <Header
          title={<h2><span>{account?.name}</span>{insured && (<Insured />)}</h2>}>
          <HideAmountsButton />
          <Link to={`/account/${code}/info`} title={t('accountInfo.title')} className="flex flex-row flex-items-center m-left-half">
            <Info className={style.accountIcon} />
            <span>{t('accountInfo.label')}</span>
          </Link>
        </Header>
        {status?.synced && hasDataLoaded && account && isBitcoinBased(account.coinCode) && (
          <HeadersSync coinCode={account.coinCode} />
        )}
        <div className="innerContainer scrollableContainer">
          <div className="content padded">

            <div className="flex flex-column flex-reverse-mobile">
              <label className="labelXLarge flex-self-start-mobile hide-on-small">
                {t('accountSummary.availableBalance')}
              </label>
              <div className="flex flex-row flex-between flex-item-center flex-column-mobile flex-reverse-mobile">
                <Balance balance={balance} />
                <label className="labelXLarge flex-self-start-mobile show-on-small">
                  {t('accountSummary.availableBalance')}
                </label>
                {!isAccountEmpty && actionButtonsProps && (
                  <ActionButtons {...actionButtonsProps} />
                )}
              </div>
            </div>
            {isAccountEmpty && (
              <BuyReceiveCTA
                account={account}
                code={code}
                exchangeBuySupported={exchangeBuySupported}
                unit={balance.available.unit}
                balanceList={[balance]}
              />
            )}
            {!isAccountEmpty && account && (
              <Transactions
                accountCode={code}
                handleExport={exportAccount}
                explorerURL={account.blockExplorerTxPrefix}
                transactions={transactions}
              />
            )}
          </div>
        </div>
      </div>
      {account && (
        <AccountGuide
          account={account}
          unit={balance?.available.unit}
          hasIncomingBalance={balance && balance.hasIncoming}
          hasTransactions={transactions !== undefined && transactions.success && transactions.list.length > 0}
          hasNoBalance={balance && balance.available.amount === '0'}
        />
      )}
    </div>
  );
};

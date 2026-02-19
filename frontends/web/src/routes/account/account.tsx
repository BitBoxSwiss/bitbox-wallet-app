// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import * as accountApi from '@/api/account';
import { statusChanged, syncAddressesCount, syncdone } from '@/api/accountsync';
import { TDevices } from '@/api/devices';
import { getMarketVendors, MarketVendors } from '@/api/market';
import { Balance } from '@/components/balance/balance';
import { HeadersSync } from '@/components/headerssync/headerssync';
import { InfoBlue, LoupeBlue } from '@/components/icon';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { Message } from '@/components/message/message';
import { useLoad, useSubscribe, useSync } from '@/hooks/api';
import { useBitsurance } from '@/hooks/bitsurance';
import { useDebounce } from '@/hooks/debounce';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { ActionButtons } from './actionButtons';
import { Insured } from './components/insuredtag';
import { AccountGuide } from './guide';
import { BuyReceiveCTA } from './info/buy-receive-cta';
import { isBitcoinBased } from './utils';
import { MultilineMarkup } from '@/utils/markup';
import { Dialog } from '@/components/dialog/dialog';
import { A } from '@/components/anchor/anchor';
import { i18n } from '@/i18n/i18n';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { TransactionList } from './components/transaction-list';
import { TransactionDetails } from '@/components/transactions/details';
import { Button, Input } from '@/components/forms';
import { SubTitle } from '@/components/title';
import { TransactionHistorySkeleton } from '@/routes/account/transaction-history-skeleton';
import { RatesContext } from '@/contexts/RatesContext';
import { OfflineError } from '@/components/banners/offline-error';
import style from './account.module.css';

type Props = {
  accounts: accountApi.TAccount[];
  code: accountApi.AccountCode;
  devices: TDevices;
};

export const Account = (props: Props) => {
  if (!props.code) {
    return null;
  }
  // The `key` prop forces a re-mount when `code` changes.
  return <RemountAccount key={props.code} {...props} />;
};

const getBitsuranceGuideLink = (
  resolvedLanguage: string | undefined,
): string => {
  switch (resolvedLanguage) {
  case 'de':
    return 'https://bitbox.swiss/redirects/bitsurance-segwit-migration-guide-de/';
  default:
    return 'https://bitbox.swiss/redirects/bitsurance-segwit-migration-guide-en/';
  }
};

// Re-mounted when `code` changes, and `code` is guaranteed to be non-empty.
const RemountAccount = ({
  accounts,
  code,
  devices,
}: Props) => {
  const { t } = useTranslation();

  const { btcUnit } = useContext(RatesContext);

  const [balance, setBalance] = useState<accountApi.TBalance>();
  const status: accountApi.TStatus | undefined = useSync(
    () => accountApi.getStatus(code),
    cb => statusChanged(code, cb),
  );
  const syncedAddressesCount = useSubscribe(syncAddressesCount(code));
  const [transactions, setTransactions] = useState<accountApi.TTransactions>();
  const [detailID, setDetailID] = useState<accountApi.TTransaction['internalID'] | null>(null);
  const [showSearchBar, setShowSearchBar] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const supportedVendors = useLoad<MarketVendors>(getMarketVendors(code), [code]);

  const account = accounts && accounts.find(acct => acct.code === code);

  const { insured, uncoveredFunds, clearUncoveredFunds } = useBitsurance(code, account);

  const loadingTransactions = transactions?.success === undefined;
  const hasTransactions = transactions?.success && transactions.list.length > 0;

  const filteredTransactions = useMemo(() => {
    if (!transactions?.success) {
      return [];
    }

    if (!debouncedSearchTerm.trim()) {
      return transactions.list;
    }

    const searchLower = debouncedSearchTerm.toLowerCase().trim();

    return transactions.list.filter(tx => {
      const noteMatch = tx.note?.toLowerCase().includes(searchLower);
      const addressMatch = tx.addresses?.some(address =>
        address.toLowerCase().includes(searchLower)
      );
      const txIdMatch = tx.txID?.toLowerCase().includes(searchLower);

      return noteMatch || addressMatch || txIdMatch;
    });
  }, [transactions, debouncedSearchTerm]);

  const onAccountChanged = useCallback((status: accountApi.TStatus | undefined) => {
    if (status === undefined || status.fatalError) {
      return;
    }
    if (status.synced && status.offlineError === null) {
      Promise.all([
        accountApi.getBalance(code).then(
          balance => {
            if (balance.success) {
              setBalance(balance.balance);
            }
          }),
        accountApi.getTransactionList(code).then(setTransactions),
      ])
        .catch(console.error);
    } else {
      setBalance(undefined);
      setTransactions(undefined);
    }
  }, [code]);

  useEffect(() => {
    if (status !== undefined && !status.disabled && !status.synced) {
      accountApi.init(code).catch(console.error);
    }
  }, [code, status]);

  useEffect(() => {
    return syncdone(code, () => onAccountChanged(status));
  }, [code, onAccountChanged, status]);

  useEffect(() => {
    onAccountChanged(status);
  }, [btcUnit, onAccountChanged, status]);

  useEffect(() => {
    if (showSearchBar && searchInputRef.current) {
      searchInputRef.current?.focus();
    }
  }, [showSearchBar]);

  const hasDataLoaded = balance !== undefined && transactions !== undefined;

  if (!account) {
    return null;
  }

  if (status?.fatalError) {
    return (
      <Spinner text={t('account.fatalError')} />
    );
  }

  // Status: not synced
  const notSyncedText = (status !== undefined && !status.synced && syncedAddressesCount !== undefined && syncedAddressesCount > 1) ? (
    '\n' + t('account.syncedAddressesCount', {
      count: syncedAddressesCount.toString(),
      defaultValue: 0,
    } as any)
  ) : '';

  const exchangeSupported = supportedVendors && supportedVendors.vendors.length > 0;

  const isAccountEmpty = balance
    && !balance.hasAvailable
    && !balance.hasIncoming
    && transactions
    && transactions.success
    && transactions.list.length === 0;


  const actionButtonsProps = {
    code,
    accountDataLoaded: hasDataLoaded,
    coinCode: account.coinCode,
    canSend: balance && balance.hasAvailable,
    exchangeSupported,
    account
  };

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <OfflineError error={status?.offlineError} />
            <GlobalBanners code={code} devices={devices} />
            <Message
              className={style.status}
              hidden={status === undefined || status.synced || !!status.offlineError}
              type="info">
              {t('account.initializing')}
              {notSyncedText}
            </Message>
          </ContentWrapper>
          <Dialog
            open={insured && uncoveredFunds.length !== 0}
            medium
            title={t('account.warning')}
            onClose={clearUncoveredFunds}>
            <MultilineMarkup tagName="p" markup={t('account.uncoveredFunds', {
              name: account.name,
              uncovered: uncoveredFunds,
            })} />
            <A href={getBitsuranceGuideLink(i18n.resolvedLanguage)}>
              {t('account.uncoveredFundsLink')}
            </A>
          </Dialog>
          <Header
            title={<h2><span>{account.name}</span>{insured && (<Insured />)}</h2>}>
            <Link
              to={`/account/${code}/info`}
              title={t('accountInfo.title')}
              className={style.accountInfoLink}>
              <InfoBlue className={style.accountIcon} />
              <span className="hide-on-small">
                {t('accountInfo.label')}
              </span>
            </Link>
            <HideAmountsButton />
          </Header>
          {status !== undefined && status.synced && hasDataLoaded && isBitcoinBased(account.coinCode) && (
            <HeadersSync coinCode={account.coinCode} />
          )}
          <View>
            <ViewHeader>
              <div className={style.balanceHeader}>
                <Balance balance={balance} />
                {!isAccountEmpty && <ActionButtons {...actionButtonsProps} />}
              </div>
            </ViewHeader>
            <ViewContent>
              <div className={style.accountHeader}>
                {isAccountEmpty && (
                  <BuyReceiveCTA
                    account={account}
                    code={code}
                    unit={balance.available.unit}
                    balanceList={[balance]}
                  />
                )}

                {transactions?.success === false ? (
                  <p className={style.errorLoadTransactions}>
                    {t('transactions.errorLoadTransactions')}
                  </p>
                ) : !isAccountEmpty && (
                  <>
                    <div className={style.titleRow}>
                      <SubTitle className={style.titleWithButton}>
                        {t('accountSummary.transactionHistory')}
                      </SubTitle>

                      <Button
                        className={style.searchButton}
                        transparent
                        disabled={!hasTransactions}
                        onClick={() => {
                          if (showSearchBar) {
                            setShowSearchBar(false);
                            setSearchTerm('');
                          } else {
                            setShowSearchBar(true);
                          }
                        }}
                      >
                        {showSearchBar ? (
                          <>✕ {t('generic.close')}</>
                        ) : (
                          <>
                            <LoupeBlue className={style.loupe} />
                            {t('generic.searchButton')}
                          </>
                        )}
                      </Button>
                    </div>

                    <div className={`
                      ${style.searchContainer || ''}
                      ${!showSearchBar && style.searchHidden || ''}
                    `}>
                      <Input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search transactions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.currentTarget.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              {loadingTransactions && <TransactionHistorySkeleton />}

              <TransactionList
                transactionSuccess={transactions?.success ?? false}
                filteredTransactions={filteredTransactions}
                debouncedSearchTerm={debouncedSearchTerm}
                onShowDetail={setDetailID}
              />

              <TransactionDetails
                accountCode={code}
                explorerURL={account.blockExplorerTxPrefix}
                internalID={detailID}
                onClose={() => setDetailID(null)}
              />
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <AccountGuide
        account={account}
        unit={balance?.available.unit}
        hasIncomingBalance={balance && balance.hasIncoming}
        hasTransactions={transactions !== undefined && transactions.success && transactions.list.length > 0}
        hasNoBalance={balance && balance.available.amount === '0'}
      />
    </GuideWrapper>
  );
};

// SPDX-License-Identifier: Apache-2.0

import { type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '../../api/account';
import {
  TLightningBalance,
  TLightningPayment,
  getBlockExplorerTxPrefix,
  getLightningBalance,
  getListPayments,
  postReconnect,
  subscribeLightningBalance,
  subscribeListPayments,
  getSparkStatus,
  TSparkStatus,
} from '../../api/lightning';
import { Balance } from '../../components/balance/balance';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { View, ViewContent, ViewHeader } from '../../components/view/view';
import { GuideWrapper, GuidedContent, Header, Main } from '../../components/layout';
import { SpinnerRingAnimated } from '../../components/spinner/SpinnerAnimation';
import { ActionButtons } from './components/action-buttons';
import { LightningGuide } from './guide';
import { LightningTorProxyWarning } from '@/components/banners/lightning-tor-proxy-warning';
import { Status } from '../../components/status/status';
import { HideAmountsButton } from '../../components/hideamountsbutton/hideamountsbutton';
import { PaymentDetails } from './components/payment-details';
import { RatesContext } from '@/contexts/RatesContext';
import { useLoad, useSync } from '@/hooks/api';
import { useMountedRef } from '@/hooks/mount';
import { useLightning } from '@/hooks/lightning';
import { Link, Navigate } from 'react-router-dom';
import {
  formatExcessLightningFundingLimit,
  formatLightningFundingLimit,
  hasExceededLightningFundingLimit,
  hasReachedLightningFundingLimit,
} from './limits';
import { TransactionList } from '@/routes/account/components/transaction-list';
import type { TTransactionListItem } from '@/routes/account/components/transaction-list';
import { TransactionHistorySkeleton } from '@/routes/account/transaction-history-skeleton';
import { Button, SearchInput } from '@/components/forms';
import { LoupeBlue } from '@/components/icon';
import { SubTitle } from '@/components/title';
import { useDebounce } from '@/hooks/debounce';
import { useMediaQuery } from '@/hooks/mediaquery';
import { useScrollIntoView } from '@/hooks/scroll-into-view';
import accountStyle from '@/routes/account/account.module.css';
import style from './lightning.module.css';

const sparkStatusPollInterval = 60 * 1000;

const bitcoinDepositTransactionStatus = (
  bitcoinDeposit: NonNullable<TLightningPayment['bitcoinDeposit']>,
): accountApi.TTransactionStatus => {
  switch (bitcoinDeposit.state) {
  case 'unclaimed':
    return 'failed';
  case 'complete':
    return 'complete';
  case 'claiming':
  case 'confirming':
    return 'pending';
  }
};

type TLightningPageLayoutProps = {
  accountDataLoaded: boolean;
  balance?: TLightningBalance;
  canSend?: boolean;
  children: ReactNode;
  statusBanners: ReactNode;
};

const LightningPageLayout = ({
  accountDataLoaded,
  balance,
  canSend,
  children,
  statusBanners,
}: TLightningPageLayoutProps) => {
  const { t } = useTranslation();
  const fundingLimit = balance?.fundingLimit;
  const canTopUp = fundingLimit !== undefined && !hasReachedLightningFundingLimit(fundingLimit);
  const showFundingLimitWarning = hasExceededLightningFundingLimit(fundingLimit);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            {statusBanners}
          </ContentWrapper>
          <Header
            title={
              <h2>
                <span>{t('lightning.accountLabel')}</span>
              </h2>
            }
          >
            <HideAmountsButton />
          </Header>
          <Status dismissibleKey="" type="warning" hidden={!showFundingLimitWarning}>
            {t('lightning.limit.accountWarning', {
              excess: formatExcessLightningFundingLimit(fundingLimit),
              limit: formatLightningFundingLimit(fundingLimit),
            })}{' '}
            <Link to="/lightning/send">{t('lightning.limit.moveCoins')}</Link>
          </Status>
          <View>
            <ViewHeader>
              <div className={accountStyle.balanceHeader}>
                <Balance balance={balance} className={style.fadeIn} />
                <ActionButtons
                  accountDataLoaded={accountDataLoaded}
                  canSend={canSend}
                  canTopUp={canTopUp}
                />
              </div>
            </ViewHeader>
            <ViewContent>
              {children}
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <LightningGuide />
    </GuideWrapper>
  );
};

const paymentToTransaction = (
  payment: TLightningPayment,
  fallbackNote: string,
  bitcoinDepositNote: string,
  bitcoinDepositStateText: (state: NonNullable<TLightningPayment['bitcoinDeposit']>['state']) => string,
  bitcoinDepositStateShortText: (state: NonNullable<TLightningPayment['bitcoinDeposit']>['state']) => string,
): TTransactionListItem => {
  const status = payment.bitcoinDeposit
    ? bitcoinDepositTransactionStatus(payment.bitcoinDeposit)
    : payment.status;
  const isComplete = status === 'complete';
  const statusProgress = payment.bitcoinDeposit?.state === 'confirming'
    ? 33
    : payment.bitcoinDeposit?.state === 'claiming'
      ? 66
      : undefined;

  return {
    addresses: [],
    amount: payment.amount,
    amountAtTime: payment.amountAtTime,
    deductedAmountAtTime: payment.deductedAmountAtTime,
    fee: payment.fee,
    feeRateInfo: '',
    gas: 0,
    internalID: payment.id,
    nonce: null,
    note: payment.bitcoinDeposit ? bitcoinDepositNote : payment.description || fallbackNote,
    numConfirmations: isComplete ? 1 : 0,
    numConfirmationsComplete: 1,
    size: 0,
    status,
    statusProgress,
    statusText: payment.bitcoinDeposit && !isComplete
      ? bitcoinDepositStateText(payment.bitcoinDeposit.state)
      : undefined,
    statusTextShort: payment.bitcoinDeposit && !isComplete
      ? bitcoinDepositStateShortText(payment.bitcoinDeposit.state)
      : undefined,
    time: payment.time,
    type: payment.type,
    txID: payment.bitcoinDeposit?.txid || payment.txId || payment.id,
    vsize: 0,
    weight: 0,
  };
};

type TLightningInnerProps = {
  explorerURL?: string;
  payments: TLightningPayment[];
};

const LightningInner = ({
  explorerURL,
  payments,
}: TLightningInnerProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [detailID, setDetailID] = useState<TLightningPayment['id'] | null>(null);
  const [showSearchBar, setShowSearchBar] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasPayments = payments.length > 0;
  const lightningTransactions = useMemo(() => {
    return payments.map(payment => paymentToTransaction(
      payment,
      payment.type === 'receive' ? t('generic.received') : t('generic.sent'),
      t('lightning.bitcoinDeposit.label'),
      (state) => t(`lightning.bitcoinDeposit.state.${state}`),
      (state) => t(`lightning.bitcoinDeposit.stateShort.${state}`),
    ));
  }, [payments, t]);
  const filteredTransactions = useMemo(() => {
    const searchLower = debouncedSearchTerm.toLowerCase().trim();

    if (!searchLower) {
      return lightningTransactions;
    }

    return lightningTransactions.filter(tx => (
      tx.note?.toLowerCase().includes(searchLower)
      || tx.txID.toLowerCase().includes(searchLower)
      || tx.status.toLowerCase().includes(searchLower)
      || tx.type.toLowerCase().includes(searchLower)
    ));
  }, [debouncedSearchTerm, lightningTransactions]);

  const scrollSearchIntoView = useScrollIntoView(searchInputRef, 48);

  useEffect(() => {
    if (showSearchBar && searchInputRef.current) {
      searchInputRef.current.focus();
      if (isMobile) {
        setTimeout(scrollSearchIntoView, 500);
      }
    }
  }, [showSearchBar, scrollSearchIntoView, isMobile]);

  return (
    <div className={style.fadeIn}>
      <div className={accountStyle.accountHeader}>
        <div className={accountStyle.titleRow}>
          <SubTitle className={accountStyle.titleWithButton}>
            {t('accountSummary.transactionHistory')}
          </SubTitle>

          <Button
            className={accountStyle.searchButton}
            transparent
            disabled={!hasPayments}
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
                <LoupeBlue className={accountStyle.loupe} />
                {t('generic.searchButton')}
              </>
            )}
          </Button>
        </div>

        <div className={`
          ${accountStyle.searchContainer || ''}
          ${!showSearchBar && accountStyle.searchHidden || ''}
        `}>
          <SearchInput
            ref={searchInputRef}
            placeholder={t('accountSummary.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
          />
        </div>
      </div>

      <TransactionList
        transactionSuccess={true}
        filteredTransactions={filteredTransactions}
        debouncedSearchTerm={debouncedSearchTerm}
        onShowDetail={setDetailID}
      />

      <PaymentDetails
        id={detailID}
        explorerURL={explorerURL}
        payment={payments.find(payment => payment.id === detailID)}
        onClose={() => setDetailID(null)}
      />
    </div>
  );
};

type TLightningReadyProps = {
  statusBanners: ReactNode;
};

const LightningReady = ({ statusBanners }: TLightningReadyProps) => {
  const { t } = useTranslation();
  const { btcUnit } = useContext(RatesContext);
  const { isLightningReady, lightningAccount } = useLightning();
  const balance = useSync(getLightningBalance, subscribeLightningBalance);
  const [payments, setPayments] = useState<TLightningPayment[]>();
  const [error, setError] = useState<string>();
  const mounted = useMountedRef();
  const blockExplorerTxPrefix = useLoad(getBlockExplorerTxPrefix);

  const onStateChange = useCallback(async () => {
    try {
      setError(undefined);
      const payments = await getListPayments();
      if (!mounted.current) {
        return;
      }
      setPayments(payments);
    } catch (err: any) {
      if (!mounted.current) {
        return;
      }
      const errorMessage = err?.errorMessage || err?.message || String(err);
      setError(errorMessage);
    }
  }, [mounted]);

  useEffect(() => {
    if (!lightningAccount || !isLightningReady) {
      return;
    }

    onStateChange();

    return subscribeListPayments(onStateChange);
  }, [btcUnit, isLightningReady, lightningAccount, onStateChange]);

  const hasDataLoaded = balance !== undefined && payments !== undefined;

  if (error) {
    return (
      <GuideWrapper>
        <GuidedContent>
          <Main>
            <ContentWrapper>
              {statusBanners}
            </ContentWrapper>
            <View textCenter verticallyCentered>
              <ViewHeader title={t('unknownError', { errorMessage: error })} />
            </View>
          </Main>
        </GuidedContent>
        <LightningGuide />
      </GuideWrapper>
    );
  }
  const canSend = balance && balance.hasAvailable;

  if (!hasDataLoaded) {
    return (
      <LightningPageLayout
        accountDataLoaded={false}
        balance={balance}
        canSend={canSend}
        statusBanners={statusBanners}
      >
        <TransactionHistorySkeleton />
      </LightningPageLayout>
    );
  }

  return (
    <LightningPageLayout
      accountDataLoaded
      balance={balance}
      canSend={canSend}
      statusBanners={statusBanners}
    >
      <LightningInner
        explorerURL={blockExplorerTxPrefix}
        payments={payments}
      />
    </LightningPageLayout>
  );
};

export const Lightning = () => {
  const { t } = useTranslation();
  const { lightningAccount, lightningStatus } = useLightning();
  const [sparkStatus, setSparkStatus] = useState<TSparkStatus>();
  const mounted = useMountedRef();

  const loadSparkStatus = useCallback(async () => {
    try {
      const status = await getSparkStatus();
      if (mounted.current) {
        setSparkStatus(status);
      }
    } catch (err) {
      console.error(err);
      if (mounted.current) {
        setSparkStatus({
          status: 'unknown',
        });
      }
    }
  }, [mounted]);

  useEffect(() => {
    loadSparkStatus();
    const interval = window.setInterval(loadSparkStatus, sparkStatusPollInterval);
    return () => window.clearInterval(interval);
  }, [loadSparkStatus]);

  const statusBanners = (
    <>
      <LightningTorProxyWarning dismissible />
      <Status
        dismissibleKey="lightning-beta-warning"
        type="warning">
        {t('lightning.betaWarning')}
      </Status>
      <Status
        hidden={sparkStatus === undefined || sparkStatus.status === 'operational'}
        dismissibleKey=""
        type={sparkStatus?.status === 'major' ? 'error' : 'warning'}>
        {sparkStatus !== undefined && sparkStatus.status !== 'operational' && t(`lightning.sparkStatus.${sparkStatus.status}`)}
      </Status>
    </>
  );

  if (lightningAccount === undefined || lightningStatus === undefined) {
    return (
      <LightningPageLayout accountDataLoaded={false} statusBanners={statusBanners}>
        <div className={style.connectionState}>
          <SpinnerRingAnimated />
          <p>{t('lightning.initializing')}</p>
        </div>
      </LightningPageLayout>
    );
  }

  if (lightningAccount === null) {
    return <Navigate replace to="/lightning/activate" />;
  }

  if (lightningAccount && lightningStatus.state === 'failed') {
    const reconnect = async () => {
      try {
        await postReconnect();
      } catch (err) {
        console.error(err);
      }
    };
    return (
      <LightningPageLayout accountDataLoaded={false} statusBanners={statusBanners}>
        <div className={style.connectionState}>
          <p>{t('lightning.connection.initializationFailed')}</p>
          <Button primary onClick={reconnect}>
            {t('generic.retry')}
          </Button>
        </div>
      </LightningPageLayout>
    );
  }

  if (lightningAccount && lightningStatus.state !== 'ready') {
    return (
      <LightningPageLayout accountDataLoaded={false} statusBanners={statusBanners}>
        <div className={style.connectionState}>
          <SpinnerRingAnimated />
          <p>{t('lightning.initializing')}</p>
        </div>
      </LightningPageLayout>
    );
  }

  return <LightningReady statusBanners={statusBanners} />;
};

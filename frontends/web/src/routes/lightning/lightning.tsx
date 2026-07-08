// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '../../api/account';
import { getDeviceList } from '../../api/devices';
import {
  TLightningBalanceLimit,
  TLightningPayment,
  getLightningBalance,
  getLightningBalanceLimit,
  getListPayments,
  subscribeListPayments,
  getSparkStatus,
  TSparkStatus,
} from '../../api/lightning';
import { Balance } from '../../components/balance/balance';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { View, ViewContent, ViewHeader } from '../../components/view/view';
import { GuideWrapper, GuidedContent, Header, Main } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { ActionButtons } from './components/action-buttons';
import { LightningGuide } from './guide';
import { GlobalBanners } from '@/components/banners';
import { Status } from '../../components/status/status';
import { HideAmountsButton } from '../../components/hideamountsbutton/hideamountsbutton';
import { PaymentDetails } from './components/payment-details';
import { LightningPayment } from './components/lightning-payment';
import styles from './lightning.module.css';
import { RatesContext } from '@/contexts/RatesContext';
import { useLoad } from '@/hooks/api';
import { useMountedRef } from '@/hooks/mount';
import { useLightning } from '@/hooks/lightning';
import { Link } from 'react-router-dom';
import {
  formatExcessLightningBalanceLimit,
  formatLightningBalanceLimit,
  hasExceededLightningBalanceLimit,
  hasReachedLightningBalanceLimit,
} from './limits';

const sparkStatusPollInterval = 60 * 1000;

export const Lightning = () => {
  const { t } = useTranslation();
  const { btcUnit } = useContext(RatesContext);
  const { isLightningReady, lightningAccount } = useLightning();
  const [balance, setBalance] = useState<accountApi.TBalance>();
  const [balanceLimit, setBalanceLimit] = useState<TLightningBalanceLimit>();
  const [syncedAddressesCount] = useState<number>();
  const [payments, setPayments] = useState<TLightningPayment[]>();
  const [sparkStatus, setSparkStatus] = useState<TSparkStatus>();
  const [error, setError] = useState<string>();
  const [detailID, setDetailID] = useState<TLightningPayment['id'] | null>(null);
  const mounted = useMountedRef();
  const devices = useLoad(getDeviceList);

  const onStateChange = useCallback(async () => {
    try {
      setError(undefined);
      const [balance, nextBalanceLimit, payments] = await Promise.all([
        getLightningBalance(),
        getLightningBalanceLimit(),
        getListPayments(),
      ]);
      if (!mounted.current) {
        return;
      }
      setBalance(balance);
      setBalanceLimit(nextBalanceLimit);
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

  const hasDataLoaded = balance !== undefined;

  const statusBanners = (
    <>
      <Status
        dismissibleKey="lightning-alpha-warning"
        type="warning">
        This is an alpha release intended for preview and testing. Only use lightning with a small amount of funds!
      </Status>
      <Status
        hidden={sparkStatus === undefined || sparkStatus.status === 'operational'}
        dismissibleKey=""
        type={sparkStatus?.status === 'major' ? 'error' : 'warning'}>
        {sparkStatus !== undefined && sparkStatus.status !== 'operational' && t(`lightning.sparkStatus.${sparkStatus.status}`)}
      </Status>
      <GlobalBanners devices={devices || {}} />
    </>
  );

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
  if (
    lightningAccount === undefined
    || isLightningReady === undefined
    || (lightningAccount && !isLightningReady)
  ) {
    return <Spinner text={t('lightning.initializing')} />;
  }

  const canSend = balance && balance.hasAvailable;
  const canTopUp = balanceLimit !== undefined && !hasReachedLightningBalanceLimit(balanceLimit);
  const showBalanceLimitWarning = hasExceededLightningBalanceLimit(balanceLimit);

  const initializingSpinnerText =
    syncedAddressesCount !== undefined && syncedAddressesCount > 1
      ? '\n' +
        t('account.syncedAddressesCount', {
          count: syncedAddressesCount.toString(),
          defaultValue: 0
        } as any)
      : '';

  const offlineErrorTextLines: string[] = [];

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
          <Status dismissibleKey="" type="warning" hidden={!showBalanceLimitWarning}>
            {t('lightning.limit.accountWarning', {
              excess: formatExcessLightningBalanceLimit(balanceLimit),
              limit: formatLightningBalanceLimit(balanceLimit),
            })}{' '}
            {/* TODO: Prefill a BitBox account address once Lightning on-chain sends are supported. */}
            <Link to="/lightning/send">{t('lightning.limit.moveCoins')}</Link>
          </Status>
          <View>
            <ViewHeader>
              <div className={styles.header}>
                <Balance balance={balance} />
                <ActionButtons
                  canSend={canSend}
                  canTopUp={canTopUp}
                />
              </div>
            </ViewHeader>
            <ViewContent fullWidth>
              {offlineErrorTextLines.length || !hasDataLoaded ? (
                <Spinner text={initializingSpinnerText} />
              ) : (
                payments && payments.length > 0 ? (
                  payments
                    .map((payment) => (
                      <LightningPayment
                        key={payment.id}
                        onShowDetail={(id: string) => {
                          setDetailID(id);
                        }}
                        {...payment}
                      />
                    ))
                ) : (
                  <div className={['flex flex-row flex-center', styles.empty || ''].join(' ').trim()}>
                    <p>{t('lightning.payments.placeholder')}</p>
                  </div>
                )
              )}

              <PaymentDetails
                id={detailID}
                payment={payments?.find(payment => payment.id === detailID)}
                onClose={() => setDetailID(null)}
              />
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <LightningGuide />
    </GuideWrapper>
  );
};

// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '../../api/account';
import { getDeviceList } from '../../api/devices';
import {
  TLightningPayment,
  getLightningBalance,
  getListPayments,
  subscribeListPayments,
  getBoardingAddress,
} from '../../api/lightning';
import { Balance } from '../../components/balance/balance';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { View, ViewContent, ViewHeader } from '../../components/view/view';
import { GuideWrapper, GuidedContent, Header, Main } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { ActionButtons } from './components/action-buttons';
import { LightningGuide } from './guide';
import { unsubscribe } from '../../utils/subscriptions';
import { GlobalBanners } from '@/components/banners';
import { Status } from '../../components/status/status';
import { HideAmountsButton } from '../../components/hideamountsbutton/hideamountsbutton';
import { PaymentDetails } from './components/payment-details';
import { LightningPayment } from './components/lightning-payment';
import styles from './lightning.module.css';
import { RatesContext } from '@/contexts/RatesContext';
import { useLoad } from '@/hooks/api';

export const Lightning = () => {
  const { t } = useTranslation();
  const { btcUnit } = useContext(RatesContext);
  const [balance, setBalance] = useState<accountApi.TBalance>();
  const [syncedAddressesCount] = useState<number>();
  const [payments, setPayments] = useState<TLightningPayment[]>();
  const [error, setError] = useState<string>();
  const [detailID, setDetailID] = useState<TLightningPayment['id'] | null>(null);
  const devices = useLoad(getDeviceList);
  const boardingAddress = useLoad(getBoardingAddress);

  const onStateChange = useCallback(async () => {
    try {
      setError(undefined);
      setBalance(await getLightningBalance());
      setPayments(await getListPayments());
    } catch (err: any) {
      const errorMessage = err?.errorMessage || err;
      setError(errorMessage);
    }
  }, []);

  useEffect(() => {
    onStateChange();

    const subscriptions = [subscribeListPayments(onStateChange)];
    return () => unsubscribe(subscriptions);
  }, [onStateChange, btcUnit]);

  const hasDataLoaded = balance !== undefined;

  if (error) {
    return (
      <View textCenter verticallyCentered>
        <ViewHeader title={t('unknownError', { errorMessage: error })} />
      </View>
    );
  }

  if (!balance) {
    // Wait for the nodeState to become available
    return <Spinner />;
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
  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <Status
              dismissibleKey="lightning-alpha-warning"
              type="warning">
              This is an alpha release intended for preview and testing. Only use lightning with a small amount of funds!
            </Status>
            <GlobalBanners devices={devices || {}} />
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
          <View>
            <ViewHeader>
              <div className={styles.header}>
                <Balance balance={balance} />
                <ActionButtons canSend={canSend} />
              </div>
            </ViewHeader>
            <ViewContent fullWidth>
              { <>Boarding address: {boardingAddress ?? ''}</> }
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

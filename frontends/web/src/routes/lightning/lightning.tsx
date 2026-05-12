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
import { Transaction } from '@/components/transactions/transaction';
import { PaymentDetails } from './components/payment-details';
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
  const [detailID, setDetailID] = useState<accountApi.TTransaction['internalID'] | null>(null);
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
                    .map(payment => ({ // TODO: giant hack start
                      internalID: payment.id,
                      addresses: [],
                      amountAtTime: {
                        amount: payment.amountSat.toString(),
                        conversions: {}, // TODO: add conversions
                        unit: 'sat' as accountApi.NativeCoinUnit,
                        estimated: false
                      },
                      deductedAmountAtTime: {
                        amount: payment.type === 'send' ? (payment.amountSat + payment.feesSat).toString() : '',
                        conversions: {}, // TODO: add conversions
                        unit: 'sat' as accountApi.NativeCoinUnit,
                        estimated: false
                      },
                      amount: {
                        amount: payment.amountSat.toString(),
                        unit: 'sat' as accountApi.NativeCoinUnit,
                        estimated: false
                      },
                      fee: {
                        amount: payment.feesSat.toString(),
                        unit: 'sat' as accountApi.NativeCoinUnit,
                        estimated: false
                      },
                      feeRatePerKb: {
                        amount: '',
                        unit: 'sat' as accountApi.NativeCoinUnit,
                        estimated: false
                      },
                      type: payment.type,
                      txID: payment.id,
                      note: payment.description || '',
                      status: payment.status,
                      time: payment.timestamp ? new Date(payment.timestamp * 1000).toString() : null, // TODO: remove hack?
                      // most of these are not for lightning
                      gas: 0,
                      nonce: null,
                      numConfirmationsComplete: payment.status === 'pending' ? 1 : 0,
                      size: 0,
                      numConfirmations: 0,
                      vsize: 0,
                      weight: 0
                    })) // TODO: giant hack end
                    .map((payment) => (
                      <Transaction
                        key={payment.internalID}
                        onShowDetail={(internalID: string) => {
                          setDetailID(internalID);
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

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

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '../../api/account';
import {
  getNodeInfo,
  getListPayments,
  subscribeListPayments,
  subscribeNodeState,
  NodeState,
  Payment,
  PaymentTypeFilter
} from '../../api/lightning';
import { Balance } from '../../components/balance/balance';
import { View, ViewHeader } from '../../components/view/view';
import { GuideWrapper, GuidedContent, Header, Main } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { ActionButtons } from './actionButtons';
import { LightningGuide } from './guide';
import { toSat } from '../../utils/conversion';
import { Payments } from './components/payments';
import { unsubscribe } from '../../utils/subscriptions';

export function Lightning() {
  const { t } = useTranslation();
  const [balance, setBalance] = useState<accountApi.IBalance>();
  const [syncedAddressesCount] = useState<number>();
  const [nodeState, setNodeState] = useState<NodeState>();
  const [payments, setPayments] = useState<Payment[]>();
  const [error, setError] = useState<string>();

  const onStateChange = useCallback(async () => {
    try {
      setError(undefined);
      const nodeState = await getNodeInfo();
      const payments = await getListPayments({ filter: PaymentTypeFilter.ALL });

      setNodeState(nodeState);
      setPayments(payments);
    } catch (err: any) {
      const errorMessage = err?.errorMessage || err;
      setError(errorMessage);
    }
  }, []);

  useEffect(() => {
    onStateChange();

    const subscriptions = [subscribeNodeState(onStateChange), subscribeListPayments(onStateChange)];
    return () => unsubscribe(subscriptions);
  }, [onStateChange]);

  useEffect(() => {
    if (nodeState) {
      setBalance({
        hasAvailable: nodeState.channelsBalanceMsat > 0,
        available: {
          amount: `${toSat(nodeState.channelsBalanceMsat)}`,
          unit: 'sat'
        },
        hasIncoming: false,
        incoming: {
          amount: '0',
          unit: 'sat'
        }
      });
    }
  }, [nodeState, nodeState?.channelsBalanceMsat]);

  const hasDataLoaded = balance !== undefined;

  if (error) {
    return (
      <View textCenter verticallyCentered>
        <ViewHeader title={t('unknownError', { errorMessage: error })} />
      </View>
    );
  }

  if (!nodeState) {
    // Wait for the nodeState to become available
    return <Spinner guideExists={false} />;
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

  const isAccountEmpty = balance && !balance.hasAvailable && !balance.hasIncoming && payments && payments.length === 0;

  const actionButtonsProps = {
    canSend
  };

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header
            title={
              <h2>
                <span>{t('lightning.accountLabel')}</span>
              </h2>
            }
          ></Header>
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
              {offlineErrorTextLines.length || !hasDataLoaded ? (
                <Spinner guideExists text={initializingSpinnerText} />
              ) : (
                <Payments payments={payments} />
              )}
            </div>
          </div>
        </Main>
      </GuidedContent>
      <LightningGuide
        unit="sats"
        hasPayments={payments && payments.length > 0}
        hasNoBalance={balance && balance.available.amount === '0'}
      />
    </GuideWrapper>
  );
}

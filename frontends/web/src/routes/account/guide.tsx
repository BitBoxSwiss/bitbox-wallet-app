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

import { useTranslation } from 'react-i18next';
import { TAccount } from '@/api/account';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { isBitcoinBased } from './utils';

type Props = {
  account: TAccount;
  unit?: string;
  hasNoBalance?: boolean;
  hasIncomingBalance?: boolean;
  hasTransactions?: boolean;
};

export const AccountGuide = ({
  account,
  unit,
  hasNoBalance,
  hasIncomingBalance,
  hasTransactions,
}: Props) => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.account')}>
      <Entry key="accountDescription" entry={{
        text: t('guide.accountDescription.text'),
        title: t('guide.accountDescription.title'),
      }} />
      {hasNoBalance && (
        <Entry key="accountSendDisabled" entry={{
          text: t('guide.accountSendDisabled.text', { unit }),
          title: t('guide.accountSendDisabled.title'),
        }} />
      )}
      <Entry key="accountReload" entry={{
        text: t('guide.accountReload.text'),
        title: t('guide.accountReload.title'),
      }} />
      {hasTransactions && (
        <Entry key="accountTransactionLabel" entry={{
          text: t('guide.accountTransactionLabel.text'),
          title: t('guide.accountTransactionLabel.title'),
        }} />
      )}
      {hasTransactions && (
        <Entry key="accountTransactionTime" entry={{
          text: t('guide.accountTransactionTime.text'),
          title: t('guide.accountTransactionTime.title'),
        }} />
      )}
      {hasTransactions && (
        <Entry key="accountTransactionAttributesGeneric" entry={{
          text: t('guide.accountTransactionAttributesGeneric.text'),
          title: t('guide.accountTransactionAttributesGeneric.title'),
        }} />
      )}
      {hasTransactions && isBitcoinBased(account.coinCode) && (
        <Entry key="accountTransactionAttributesBTC" entry={{
          text: t('guide.accountTransactionAttributesBTC.text'),
          title: t('guide.accountTransactionAttributesBTC.title'),
        }} />
      )}
      {hasIncomingBalance && (
        <Entry key="accountIncomingBalance" entry={{
          text: t('guide.accountIncomingBalance.text'),
          title: t('guide.accountIncomingBalance.title'),
        }} />
      )}
      <Entry key="accountTransactionConfirmation" entry={{
        text: t('guide.accountTransactionConfirmation.text'),
        title: t('guide.accountTransactionConfirmation.title'),
      }} />
      <Entry key="accountFiat" entry={{
        text: t('guide.accountFiat.text'),
        title: t('guide.accountFiat.title'),
      }} />

      { /* careful, also used in Settings */ }
      <Entry key="accountRates" entry={{
        link: {
          text: 'www.coingecko.com',
          url: 'https://www.coingecko.com/'
        },
        text: t('guide.accountRates.text'),
        title: t('guide.accountRates.title')
      }} />

      <Entry key="cointracking" entry={{
        link: {
          text: 'CoinTracking',
          url: 'https://cointracking.info/import/bitbox/?ref=BITBOX',
        },
        text: t('guide.cointracking.text'),
        title: t('guide.cointracking.title')
      }} />
    </Guide>
  );
};

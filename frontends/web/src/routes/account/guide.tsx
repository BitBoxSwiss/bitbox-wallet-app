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
import { IAccount } from '../../api/account';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { isBitcoinBased } from './utils';

type Props = {
  account: IAccount;
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
      <Entry key="accountDescription" entry={t('guide.accountDescription')} />
      {hasNoBalance && (
        <Entry key="accountSendDisabled" entry={t('guide.accountSendDisabled', {
          unit
        })} />
      )}
      <Entry key="accountReload" entry={t('guide.accountReload')} />
      {hasTransactions && (
        <Entry key="accountTransactionLabel" entry={t('guide.accountTransactionLabel')} />
      )}
      {hasTransactions && (
        <Entry key="accountTransactionTime" entry={t('guide.accountTransactionTime')} />
      )}
      {hasTransactions && (
        <Entry key="accountTransactionAttributesGeneric" entry={t('guide.accountTransactionAttributesGeneric')} />
      )}
      {hasTransactions && isBitcoinBased(account.coinCode) && (
        <Entry key="accountTransactionAttributesBTC" entry={t('guide.accountTransactionAttributesBTC')} />
      )}
      {hasIncomingBalance && (
        <Entry key="accountIncomingBalance" entry={t('guide.accountIncomingBalance')} />
      )}
      <Entry key="accountTransactionConfirmation" entry={t('guide.accountTransactionConfirmation')} />
      <Entry key="accountFiat" entry={t('guide.accountFiat')} />

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

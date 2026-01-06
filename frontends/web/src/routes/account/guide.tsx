// SPDX-License-Identifier: Apache-2.0

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
      <Entry key="accountDescription" entry={t('guide.accountDescription', { returnObjects: true })} />
      {hasNoBalance && (
        <Entry key="accountSendDisabled" entry={t('guide.accountSendDisabled', {
          unit,
          returnObjects: true
        })} />
      )}
      <Entry key="accountReload" entry={t('guide.accountReload', { returnObjects: true })} />
      {hasTransactions && (
        <Entry key="accountTransactionLabel" entry={t('guide.accountTransactionLabel', { returnObjects: true })} />
      )}
      {hasTransactions && (
        <Entry key="accountTransactionTime" entry={t('guide.accountTransactionTime', { returnObjects: true })} />
      )}
      {hasTransactions && (
        <Entry key="accountTransactionAttributesGeneric" entry={t('guide.accountTransactionAttributesGeneric', { returnObjects: true })} />
      )}
      {hasTransactions && isBitcoinBased(account.coinCode) && (
        <Entry key="accountTransactionAttributesBTC" entry={t('guide.accountTransactionAttributesBTC', { returnObjects: true })} />
      )}
      {hasIncomingBalance && (
        <Entry key="accountIncomingBalance" entry={t('guide.accountIncomingBalance', { returnObjects: true })} />
      )}
      <Entry key="accountTransactionConfirmation" entry={t('guide.accountTransactionConfirmation', { returnObjects: true })} />
      <Entry key="accountFiat" entry={t('guide.accountFiat', { returnObjects: true })} />

      { /* careful, also used in Settings */ }
      <Entry key="accountRates" entry={{
        link: {
          text: 'www.coingecko.com',
          url: 'https://www.coingecko.com/'
        },
        text: t('guide.accountRates.text'),
        title: t('guide.accountRates.title')
      }} />

      <Entry key="guide.accountInfo.exportTransactions" entry={{
        link: {
          text: 'CoinTracking',
          url: 'https://cointracking.info/import/bitbox/?ref=BITBOX',
        },
        text: t('guide.accountInfo.exportTransactions.text'),
        title: t('guide.accountInfo.exportTransactions.title')
      }} />
    </Guide>
  );
};

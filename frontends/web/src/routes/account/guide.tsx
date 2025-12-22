// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { TAccount } from '@/api/account';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { isBitcoinBased } from './utils';
import { getGuideEntry } from '@/utils/i18n-helpers';

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
      <Entry key="accountDescription" entry={getGuideEntry(t, 'guide.accountDescription')} />
      {hasNoBalance && (
        <Entry key="accountSendDisabled" entry={getGuideEntry(t, 'guide.accountSendDisabled', { unit })} />
      )}
      <Entry key="accountReload" entry={getGuideEntry(t, 'guide.accountReload')} />
      {hasTransactions && (
        <Entry key="accountTransactionLabel" entry={getGuideEntry(t, 'guide.accountTransactionLabel')} />
      )}
      {hasTransactions && (
        <Entry key="accountTransactionTime" entry={getGuideEntry(t, 'guide.accountTransactionTime')} />
      )}
      {hasTransactions && (
        <Entry key="accountTransactionAttributesGeneric" entry={getGuideEntry(t, 'guide.accountTransactionAttributesGeneric')} />
      )}
      {hasTransactions && isBitcoinBased(account.coinCode) && (
        <Entry key="accountTransactionAttributesBTC" entry={getGuideEntry(t, 'guide.accountTransactionAttributesBTC')} />
      )}
      {hasIncomingBalance && (
        <Entry key="accountIncomingBalance" entry={getGuideEntry(t, 'guide.accountIncomingBalance')} />
      )}
      <Entry key="accountTransactionConfirmation" entry={getGuideEntry(t, 'guide.accountTransactionConfirmation')} />
      <Entry key="accountFiat" entry={getGuideEntry(t, 'guide.accountFiat')} />

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

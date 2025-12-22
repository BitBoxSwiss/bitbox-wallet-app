// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { getGuideEntry } from '@/utils/i18n-helpers';

type Props = {
  coinName: string;
};

export const BitcoinBasedAccountInfoGuide = ({
  coinName,
}: Props) => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.accountInformation')}>
      <Entry key="guide.accountInfo.xpub" entry={getGuideEntry(t, 'guide.accountInfo.xpub')} shown={true} />
      <Entry key="guide.accountInfo.multipleXPubs" entry={{
        text: t('guide.accountInfo.multipleXPubs.text', { coinName }),
        title: t('guide.accountInfo.multipleXPubs.title'),
      }} />
      <Entry key="guide.accountInfo.privacy" entry={getGuideEntry(t, 'guide.accountInfo.privacy')} />
      <Entry key="guide.accountInfo.verify" entry={getGuideEntry(t, 'guide.accountInfo.verify')} />
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

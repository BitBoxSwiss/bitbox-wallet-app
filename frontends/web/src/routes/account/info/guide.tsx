// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';

type Props = {
  coinName: string;
};

export const BitcoinBasedAccountInfoGuide = ({
  coinName,
}: Props) => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.accountInformation')}>
      <Entry key="guide.accountInfo.xpub" entry={t('guide.accountInfo.xpub', { returnObjects: true })} shown={true} />
      <Entry key="guide.accountInfo.multipleXPubs" entry={{
        text: t('guide.accountInfo.multipleXPubs.text', { coinName }),
        title: t('guide.accountInfo.multipleXPubs.title'),
      }} />
      <Entry key="guide.accountInfo.privacy" entry={t('guide.accountInfo.privacy', { returnObjects: true })} />
      <Entry key="guide.accountInfo.verify" entry={t('guide.accountInfo.verify', { returnObjects: true })} />
    </Guide>
  );
};

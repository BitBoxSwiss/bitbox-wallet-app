// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { getGuideEntry } from '@/utils/i18n-helpers';

export const WCGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.walletConnect')}>
      <Entry
        key="guide.walletConnect.whatIsWalletConnect"
        entry={getGuideEntry(t, 'guide.walletConnect.whatIsWalletConnect')}
      />
      <Entry
        key="guide.walletConnect.supportedNetworks"
        entry={getGuideEntry(t, 'guide.walletConnect.supportedNetworks')}
      />
      <Entry
        key="guide.walletConnect.noPreviousConnections"
        entry={getGuideEntry(t, 'guide.walletConnect.noPreviousConnections')}
      />
    </Guide>
  );
};

// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';

export const WCGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.walletConnect')}>
      <Entry
        key="guide.walletConnect.whatIsWalletConnect"
        entry={{
          text: t('guide.walletConnect.whatIsWalletConnect.text'),
          title: t('guide.walletConnect.whatIsWalletConnect.title'),
        }}
      />
      <Entry
        key="guide.walletConnect.supportedNetworks"
        entry={{
          text: t('guide.walletConnect.supportedNetworks.text'),
          title: t('guide.walletConnect.supportedNetworks.title'),
        }}
      />
      <Entry
        key="guide.walletConnect.noPreviousConnections"
        entry={{
          text: t('guide.walletConnect.noPreviousConnections.text'),
          title: t('guide.walletConnect.noPreviousConnections.title'),
        }}
      />
    </Guide>
  );
};

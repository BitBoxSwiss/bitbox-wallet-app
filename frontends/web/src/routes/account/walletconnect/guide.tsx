import { useTranslation } from 'react-i18next';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';

export const WCGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.walletConnect')}>
      <Entry
        key="guide.walletConnect.whatIsWalletConnect"
        entry={t('guide.walletConnect.whatIsWalletConnect', {
          returnObjects: true,
        })}
      />
      <Entry
        key="guide.walletConnect.supportedNetworks"
        entry={t('guide.walletConnect.supportedNetworks', {
          returnObjects: true,
        })}
      />
      <Entry
        key="guide.walletConnect.noPreviousConnections"
        entry={t('guide.walletConnect.noPreviousConnections', {
          returnObjects: true,
        })}
      />
    </Guide>
  );
};

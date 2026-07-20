// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { Checked } from '@/components/icon';
import { SubTitle } from '@/components/title';
import { getKeystoreName } from '@/api/keystores';
import { useLoad } from '@/hooks/api';
import { useLightning } from '@/hooks/lightning';
import { SettingsItem } from './components/settingsItem/settingsItem';
import { MobileHeader } from './components/mobile-header';
import { TPagePropsWithSettingsTabs } from './types';
import styles from './lightning-settings.module.css';

const serviceProvider = 'Spark';
const noop = () => undefined;

export const LightningSettings = ({
  devices,
}: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lightningAccount } = useLightning();
  const keystoreNameResponse = useLoad(
    lightningAccount
      ? () => getKeystoreName(lightningAccount.rootFingerprint)
      : null,
    [lightningAccount?.rootFingerprint]
  );

  const renderContent = () => {
    if (lightningAccount === undefined) {
      return null;
    }

    if (lightningAccount === null) {
      return (
        <SettingsItem
          settingName={t('lightning.settings.enableWallet')}
          secondaryText={t('lightning.settings.enableWalletDescription')}
          onClick={() => navigate('/lightning/activate/')}
        />
      );
    }

    const keystoreDisplayName = keystoreNameResponse === undefined
      ? undefined
      : keystoreNameResponse.success
        ? `${keystoreNameResponse.keystoreName} (${lightningAccount.rootFingerprint})`
        : lightningAccount.rootFingerprint;

    return (
      <>
        <SubTitle className={styles.sectionTitle}>{t('lightning.settings.information')}</SubTitle>
        <SettingsItem
          settingName={t('lightning.settings.status')}
          displayedValue={t('lightning.settings.statusConnected')}
          extraComponent={<Checked className={styles.statusIcon} />}
        />
        <SettingsItem
          settingName={t('lightning.settings.serviceProvider')}
          displayedValue={serviceProvider}
        />
        <SettingsItem
          settingName={t('lightning.settings.wallet')}
          displayedValue={keystoreDisplayName}
        />
        <SettingsItem
          settingName={t('lightning.settings.setLightningAddress')}
          onClick={() => navigate('/lightning/set-lnurl-address/')}
        />
        <SettingsItem
          settingName={t('lightning.settings.manuallyClaimTopUp')}
          onClick={noop}
        />
        <SubTitle className={styles.sectionTitle}>{t('lightning.settings.expert')}</SubTitle>
        <SettingsItem
          settingName={<span className={styles.danger}>{t('lightning.settings.shutDownWallet')}</span>}
          onClick={() => navigate('/lightning/deactivate/')}
        />
        <SettingsItem
          settingName={<span className={styles.danger}>{t('lightning.settings.closeAndWithdrawFunds')}</span>}
          onClick={() => navigate('/lightning/close-withdraw-funds/')}
        />
      </>
    );
  };

  return (
    <Main>
      <ContentWrapper>
        <GlobalBanners devices={devices} />
      </ContentWrapper>
      <Header
        hideSidebarToggler
        title={
          <>
            <h2 className="hide-on-small">{t('lightning.settings.title')}</h2>
            <MobileHeader title={t('lightning.settings.title')} />
          </>
        }
      />
      <View fullscreen={false}>
        <ViewContent>
          {renderContent()}
        </ViewContent>
      </View>
    </Main>
  );
};

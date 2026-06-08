// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { View, ViewContent } from '@/components/view/view';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { useOnlyVisitableOnMobile } from '@/hooks/onlyvisitableonmobile';
import { useDarkmode } from '@/hooks/darkmode';
import { CogDark, CogLight, ShieldDark, ShieldLight } from '@/components/icon';
import { TDevices } from '@/api/devices';
import { useLoad } from '@/hooks/api';
import { getVersion } from '@/api/bitbox02';
import styles from './more.module.css';

/**
 * This component will only be shown on mobile.
 **/

type Props = {
  devices: TDevices;
};

export const More = ({ devices }: Props) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  useOnlyVisitableOnMobile('/settings/general');
  const deviceID = Object.keys(devices)[0];
  const isBitBox02 = deviceID && devices[deviceID] === 'bitbox02';
  const versionInfo = useLoad(isBitBox02 ? () => getVersion(deviceID) : null, [deviceID, isBitBox02]);
  const canUpgrade = versionInfo ? versionInfo.canUpgrade : false;

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <GlobalBanners devices={devices} />
          </ContentWrapper>
          <Header
            title={<h2>{t('settings.more')}</h2>} />
          <View fullscreen={false}>
            <ViewContent>
              <div className={styles.container}>
                <SettingsItem
                  settingName={
                    <div className={styles.item}>
                      {isDarkMode
                        ? <CogLight width={18} height={18} alt={t('sidebar.settings')} />
                        : <CogDark width={18} height={18} alt={t('sidebar.settings')} />}
                      {t('sidebar.settings')}
                    </div>
                  }
                  onClick={() => navigate('/settings')}
                  canUpgrade={canUpgrade}
                />
                <SettingsItem
                  settingName={
                    <div className={styles.item}>
                      {isDarkMode
                        ? <ShieldLight width={18} height={18} alt={t('sidebar.insurance')} />
                        : <ShieldDark width={18} height={18} alt={t('sidebar.insurance')} />}
                      {t('sidebar.insurance')}
                    </div>
                  }
                  onClick={() => navigate('/bitsurance/bitsurance')}
                />
              </div>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};

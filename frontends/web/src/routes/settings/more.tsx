// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { View, ViewContent } from '@/components/view/view';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { ActionableItem } from '@/components/actionable-item/actionable-item';
import { useOnlyVisitableOnMobile } from '@/hooks/onlyvisitableonmobile';
import { ChevronRightDark, CogGray, RedDot, ShieldGray } from '@/components/icon';
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
            <ViewContent fullWidth>
              <div className={styles.container}>
                <ActionableItem
                  icon={canUpgrade ? (
                    <div className={styles.iconContainer}>
                      <RedDot width={8} height={8} />
                      <ChevronRightDark
                        width={19}
                        height={19}
                      />
                    </div>
                  ) : (
                    <ChevronRightDark
                      width={19}
                      height={19}
                    />
                  )}
                  onClick={() => navigate('/settings')}
                >
                  <div className={styles.item}>
                    <CogGray width={22} height={22} alt={t('sidebar.settings')} />
                    {t('sidebar.settings')}
                  </div>
                </ActionableItem>
                <ActionableItem
                  onClick={() => navigate('/bitsurance/bitsurance')}
                >
                  <div className={styles.item}>
                    <ShieldGray width={22} height={22} alt={t('sidebar.insurance')} />
                    {t('sidebar.insurance')}
                  </div>
                </ActionableItem>
              </div>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};

/**
 * Copyright 2025 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { View, ViewContent } from '@/components/view/view';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { ActionableItem } from '@/components/actionable-item/actionable-item';
import { useOnlyVisitableOnMobile } from '@/hooks/onlyvisitableonmobile';
import { ChevronRightDark, Cog, RedDot, ShieldGray } from '@/components/icon';
import { TDevices } from '@/api/devices';
import { useLoad } from '@/hooks/api';
import { getVersion } from '@/api/bitbox02';
import styles from './more.module.css';

/**
 * This component will only be shown on mobile.
 **/

type Props = {
  devices: TDevices;
}

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
                        width={24}
                        height={24}
                      />
                    </div>
                  ) : (
                    <ChevronRightDark
                      width={24}
                      height={24}
                    />
                  )}
                  onClick={() => navigate('/settings')}
                >
                  <div className={styles.item}>
                    <Cog width={22} height={22} alt={t('sidebar.settings')} />
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

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
import styles from './more.module.css';
import shieldIcon from '@/assets/icons/shield_grey.svg';
import settingsIcon from '@/assets/icons/settings-alt.svg';

/**
 * This component will only be shown on mobile.
 **/
export const More = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useOnlyVisitableOnMobile('/settings/general');

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <GlobalBanners />
          </ContentWrapper>
          <Header title={<h2>{t('settings.more')}</h2>} />
          <View fullscreen={false}>
            <ViewContent>
              <div className={styles.container}>
                <ActionableItem onClick={() => navigate('/settings')}>
                  <div className={styles.item}>
                    <img
                      width={22}
                      height={22}
                      draggable={false}
                      src={settingsIcon}
                      alt={t('sidebar.settings')}
                    />
                    {t('sidebar.settings')}
                  </div>
                </ActionableItem>
                <ActionableItem
                  onClick={() => navigate('/bitsurance/bitsurance')}
                >
                  <div className={styles.item}>
                    <img
                      width={22}
                      height={22}
                      draggable={false}
                      src={shieldIcon}
                      alt={t('sidebar.insurance')}
                    />
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

/**
 * Copyright 2023 Shift Crypto AG
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
import { Main, Header } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { AppVersion } from './components/about/app-version-setting';
import { TPagePropsWithSettingsTabs } from './type';


export const About = ({ deviceIDs, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  return (
    <Main>
      <div className="hide-on-small"><Header title={<h2>{t('sidebar.settings')}</h2>} /></div>
      <View fullscreen={false}>
        <ViewContent>
          <WithSettingsTabs deviceIDs={deviceIDs} hideMobileMenu hasAccounts={hasAccounts} subPageTitle={t('settings.about')}>
            <AppVersion />
          </WithSettingsTabs>
        </ViewContent>
      </View>
    </Main>
  );
};

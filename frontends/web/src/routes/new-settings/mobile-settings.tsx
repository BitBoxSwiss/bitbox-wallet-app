/**
 * Copyright 2023 Shift Devices AG
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

import { useEffect } from 'react';
import { View, ViewContent } from '../../components/view/view';
import { Header, Main } from '../../components/layout';
import { route } from '../../utils/route';
import { useMediaQuery } from '../../hooks/mediaquery';
import { Tabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './type';

/**
 * The "index" page of the settings
 * that will only be shown on Mobile.
 *
 * The data will be the same as the "tabs"
 * we see on Desktop, as it's the equivalent
 * of "tabs" on Mobile.
 **/
export const MobileSettings = ({ deviceIDs, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  useEffect(() => {
    if (!isMobile) {
      route('/new-settings/appearance');
    }
  }, [isMobile]);
  return (
    <Main>
      <Header title={<h2>Settings</h2>} />
      <View fullscreen={false}>
        <ViewContent>
          <Tabs deviceIDs={deviceIDs} hasAccounts={hasAccounts} />
        </ViewContent>
      </View>
    </Main>
  );
};
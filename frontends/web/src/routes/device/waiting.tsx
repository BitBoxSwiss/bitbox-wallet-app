/**
 * Copyright 2018 Shift Devices AG
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
import { i18n } from '../../i18n/i18n';
import { useLoad } from '../../hooks/api';
import { getTesting } from '../../api/backend';
import { GuidedContent, GuideWrapper, Header, Main, Subtitle } from '../../components/layout';
import { View, ViewContent, ViewHeader } from '../../components/view/view';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { debug } from '../../utils/env';
import { SkipForTesting } from './components/skipfortesting';

export const Waiting = () => {
  const { t } = useTranslation();
  const testing = useLoad(debug ? getTesting : () => Promise.resolve(false));

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header />
          <View
            textCenter
            verticallyCentered
            width="480px"
            withBottomBar>
            <ViewHeader withAppLogo small>
              {t('welcome.title')}
            </ViewHeader>
            <ViewContent minHeight="3rem" textAlign="center">
              <Subtitle>
                {t('welcome.message')}
              </Subtitle>
              { testing && (
                <SkipForTesting />
              )}
            </ViewContent>
          </View>
        </GuidedContent>
        <Guide>
          <Entry entry={t('guide.waiting.welcome')} shown={true} />
          <Entry entry={{
            link: {
              text: t('guide.waiting.getDevice.link.text'),
              url: 'https://shiftcrypto.shop/',
            },
            text: t('guide.waiting.getDevice.text'),
            title: t('guide.waiting.getDevice.title'),
          }} />
          <Entry entry={{
            link: {
              text: t('guide.waiting.lostDevice.link.text'),
              url: (i18n.language === 'de')
                ? 'https://shiftcrypto.support/help/de-de/5-backup/8-wie-kann-ich-ein-bitbox02-wallet-in-ein-drittanbieter-wallet-importieren'
                : 'https://shiftcrypto.support/help/en-us/5-backup/8-how-do-i-restore-my-wallet-if-my-bitbox02-is-lost',
            },
            text: t('guide.waiting.lostDevice.text'),
            title: t('guide.waiting.lostDevice.title'),
          }} />
          <Entry entry={t('guide.waiting.internet')} />
          <Entry entry={t('guide.waiting.deviceNotRecognized')} />
          <Entry entry={t('guide.waiting.useWithoutDevice')} />
        </Guide>
      </GuideWrapper>
    </Main>
  );
};

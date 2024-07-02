/**
 * Copyright 2018 Shift Devices AG
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
import { i18n } from '@/i18n/i18n';
import { getDeviceList } from '@/api/devices';
import { syncDeviceList } from '@/api/devicessync';
import { useSync } from '@/hooks/api';
import { useKeystores } from '@/hooks/backend';
import { useDarkmode } from '@/hooks/darkmode';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { Spinner } from '@/components/spinner/Spinner';
import { AppLogo, AppLogoInverted, SwissMadeOpenSource, SwissMadeOpenSourceDark } from '@/components/icon/logo';
import { Footer, Header } from '@/components/layout';
import style from './bitbox01/bitbox01.module.css';

export const Waiting = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();

  const keystores = useKeystores();
  const devices = useSync(getDeviceList, syncDeviceList);
  const loadingAccounts = (keystores !== undefined && keystores.length) || (devices !== undefined && Object.keys(devices).length);

  if (loadingAccounts) {
    return (
      <Spinner guideExists text={t('welcome.loadingAccounts')} />
    );
  }
  return (
    <div className="contentWithGuide">
      <div className="container">
        <Header title={<h2>{t('welcome.title')}</h2>} />
        <div className="content padded narrow isVerticallyCentered">
          <div>
            {isDarkMode ? (<AppLogoInverted />) : (<AppLogo />)}
            <div className="box large">
              <h3 className={style.waitingText}>{t('welcome.insertDevice')}</h3>
              <p className={style.waitingDescription}>{t('welcome.insertBitBox02')}</p>
            </div>
          </div>
        </div>
        <Footer>
          {isDarkMode ? (<SwissMadeOpenSourceDark />) : (<SwissMadeOpenSource />)}
        </Footer>
      </div>
      <Guide>
        <Entry entry={t('guide.waiting.welcome', { returnObjects: true })} shown={true} />
        <Entry entry={{
          link: {
            text: t('guide.waiting.getDevice.link.text'),
            url: 'https://bitbox.shop/',
          },
          text: t('guide.waiting.getDevice.text'),
          title: t('guide.waiting.getDevice.title'),
        }} />
        <Entry entry={{
          link: {
            text: t('guide.waiting.lostDevice.link.text'),
            url: (i18n.resolvedLanguage === 'de')
              ? 'https://bitbox.swiss/redirects/restore-wallet-without-bitbox-de/'
              : 'https://bitbox.swiss/redirects/restore-wallet-without-bitbox-en/',
          },
          text: t('guide.waiting.lostDevice.text'),
          title: t('guide.waiting.lostDevice.title'),
        }} />
        <Entry entry={t('guide.waiting.internet', { returnObjects: true })} />
        <Entry entry={t('guide.waiting.deviceNotRecognized', { returnObjects: true })} />
        <Entry entry={t('guide.waiting.useWithoutDevice', { returnObjects: true })} />
      </Guide>
    </div>
  );
};

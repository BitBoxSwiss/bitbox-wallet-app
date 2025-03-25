/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022-2024 Shift Crypto AG
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

import { MouseEventHandler, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '@/contexts/AppContext';
import { i18n } from '@/i18n/i18n';
import { ElectrumServers } from './electrum-servers';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Header } from '@/components/layout';

export const ElectrumSettings = () => {
  const { t } = useTranslation();
  const { isTesting } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState<'btc' | 'ltc'>('btc');

  const handleTab: MouseEventHandler = (e) => {
    const selectedTab = e.currentTarget.getAttribute('data-tab');
    if (selectedTab !== 'btc' && selectedTab !== 'ltc') {
      console.error('Unrecognized tab ID');
      return;
    }
    setActiveTab(selectedTab);
  };
  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{t('settings.expert.electrum.title')}</h2>} />
          <div className="content padded">
            <div className="flex flex-row flex-between flex-items-center tabs">
              <div
                className={['tab', activeTab === 'btc' ? 'active' : ''].join(
                  ' ',
                )}
              >
                <Button transparent onClick={handleTab} data-tab="btc">
                  {t(`settings.electrum.title-${isTesting ? 'tbtc' : 'btc'}`)}
                </Button>
              </div>
              <div
                className={['tab', activeTab === 'ltc' ? 'active' : ''].join(
                  ' ',
                )}
              >
                <Button transparent onClick={handleTab} data-tab="ltc">
                  {t(`settings.electrum.title-${isTesting ? 'tltc' : 'ltc'}`)}
                </Button>
              </div>
            </div>
            {activeTab === 'btc' && (
              <ElectrumServers
                key={isTesting ? 'tbtc' : 'btc'}
                coin={isTesting ? 'tbtc' : 'btc'}
              />
            )}
            {activeTab === 'ltc' && (
              <ElectrumServers
                key={isTesting ? 'tltc' : 'ltc'}
                coin={isTesting ? 'tltc' : 'ltc'}
              />
            )}
            <div style={{ marginBottom: 20 }}>
              <BackButton>{t('button.back')}</BackButton>
            </div>
          </div>
        </div>
      </div>
      <Guide>
        <Entry
          key="guide.settings-electrum.what"
          entry={t('guide.settings-electrum.what', { returnObjects: true })}
        />
        <Entry
          key="guide.settings-electrum.why"
          entry={t('guide.settings-electrum.why', { returnObjects: true })}
        />
        <Entry
          key="guide.settings-electrum.options"
          entry={t('guide.settings-electrum.options', { returnObjects: true })}
        />
        <Entry
          key="guide.settings-electrum.connection"
          entry={t('guide.settings-electrum.connection', {
            returnObjects: true,
          })}
        />
        <Entry
          key="guide.settings-electrum.tor"
          entry={t('guide.settings-electrum.tor', { returnObjects: true })}
        />
        <Entry
          key="guide.settings-electrum.instructions"
          entry={{
            link: {
              text: t('guide.settings-electrum.instructions.link.text'),
              url:
                i18n.resolvedLanguage === 'de'
                  ? 'https://bitbox.swiss/redirects/connect-your-own-full-node-de/'
                  : 'https://bitbox.swiss/redirects/connect-your-own-full-node-en/',
            },
            text: t('guide.settings-electrum.instructions.text'),
            title: t('guide.settings-electrum.instructions.title'),
          }}
        />
      </Guide>
    </div>
  );
};

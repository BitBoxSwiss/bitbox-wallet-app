/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
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

import { MouseEventHandler, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '../../i18n/i18n';
import { ElectrumServers } from './electrum-servers';
import { getTesting } from '../../api/backend';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { ButtonLink } from '../../components/forms';
import { useLoad } from '../../hooks/api';
import { Header } from '../../components/layout';

export const ElectrumSettings = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'btc' | 'ltc'>('btc');
  const testing = useLoad(() => getTesting());

  const handleTab: MouseEventHandler = e => {
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
              <div className={['tab', activeTab === 'btc' ? 'active' : ''].join(' ')}>
                <a href="#" onClick={handleTab} data-tab="btc">{t(`settings.electrum.title-${testing ? 'tbtc' : 'btc'}`)}</a>
              </div>
              <div className={['tab', activeTab === 'ltc' ? 'active' : ''].join(' ')}>
                <a href="#" onClick={handleTab} data-tab="ltc">{t(`settings.electrum.title-${testing ? 'tltc' : 'ltc'}`)}</a>
              </div>
            </div>
            {
              activeTab === 'btc' && (
                <ElectrumServers
                  key={testing ? 'tbtc' : 'btc'}
                  coin={testing ? 'tbtc' : 'btc'}
                />
              )
            }
            {
              activeTab === 'ltc' && (
                <ElectrumServers
                  key={testing ? 'tltc' : 'ltc'}
                  coin={testing ? 'tltc' : 'ltc'}
                />
              )
            }
            <div style={{ marginBottom: 20 }}>
              <ButtonLink
                secondary
                to={'/settings'}>
                {t('button.back')}
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
      <Guide>
        <Entry key="guide.settings-electrum.what" entry={t('guide.settings-electrum.what')} />
        <Entry key="guide.settings-electrum.why" entry={t('guide.settings-electrum.why')} />
        <Entry key="guide.settings-electrum.options" entry={t('guide.settings-electrum.options')} />
        <Entry key="guide.settings-electrum.connection" entry={t('guide.settings-electrum.connection')} />
        <Entry key="guide.settings-electrum.tor" entry={t('guide.settings-electrum.tor')} />
        <Entry key="guide.settings-electrum.instructions" entry={{
          link: {
            text: t('guide.settings-electrum.instructions.link.text'),
            url: (i18n.resolvedLanguage === 'de')
              ? 'https://shiftcrypto.support/help/de-de/14-privatsphare/29-verbindung-der-bitboxapp-zu-meinem-bitcoin-full-node'
              : 'https://shiftcrypto.support/help/en-us/14-privacy/29-how-to-connect-the-bitboxapp-to-my-own-full-node'
          },
          text: t('guide.settings-electrum.instructions.text'),
          title: t('guide.settings-electrum.instructions.title')
        }} />
      </Guide>
    </div>
  );
};

// SPDX-License-Identifier: Apache-2.0

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
                <Button transparent onClick={handleTab} data-tab="btc">
                  {t(`settings.electrum.title-${isTesting ? 'tbtc' : 'btc'}`)}
                </Button>
              </div>
              <div className={['tab', activeTab === 'ltc' ? 'active' : ''].join(' ')}>
                <Button transparent onClick={handleTab} data-tab="ltc">
                  {t(`settings.electrum.title-${isTesting ? 'tltc' : 'ltc'}`)}
                </Button>
              </div>
            </div>
            {
              activeTab === 'btc' && (
                <ElectrumServers
                  key={isTesting ? 'tbtc' : 'btc'}
                  coin={isTesting ? 'tbtc' : 'btc'}
                />
              )
            }
            {
              activeTab === 'ltc' && (
                <ElectrumServers
                  key={isTesting ? 'tltc' : 'ltc'}
                  coin={isTesting ? 'tltc' : 'ltc'}
                />
              )
            }
            <div style={{ marginBottom: 20 }}>
              <BackButton>
                {t('button.back')}
              </BackButton>
            </div>
          </div>
        </div>
      </div>
      <Guide>
        <Entry key="guide.settings-electrum.what" entry={{
          text: t('guide.settings-electrum.what.text'),
          title: t('guide.settings-electrum.what.title'),
        }} />
        <Entry key="guide.settings-electrum.why" entry={{
          text: t('guide.settings-electrum.why.text'),
          title: t('guide.settings-electrum.why.title'),
        }} />
        <Entry key="guide.settings-electrum.options" entry={{
          text: t('guide.settings-electrum.options.text'),
          title: t('guide.settings-electrum.options.title'),
        }} />
        <Entry key="guide.settings-electrum.connection" entry={{
          text: t('guide.settings-electrum.connection.text'),
          title: t('guide.settings-electrum.connection.title'),
        }} />
        <Entry key="guide.settings-electrum.tor" entry={{
          text: t('guide.settings-electrum.tor.text'),
          title: t('guide.settings-electrum.tor.title'),
        }} />
        <Entry key="guide.settings-electrum.instructions" entry={{
          link: {
            text: t('guide.settings-electrum.instructions.link.text'),
            url: (i18n.resolvedLanguage === 'de')
              ? 'https://bitbox.swiss/redirects/connect-your-own-full-node-de/'
              : 'https://bitbox.swiss/redirects/connect-your-own-full-node-en/'
          },
          text: t('guide.settings-electrum.instructions.text'),
          title: t('guide.settings-electrum.instructions.title')
        }} />
      </Guide>
    </div>
  );
};
